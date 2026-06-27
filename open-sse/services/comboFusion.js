/**
 * Fusion combo strategy: parallel model execution with a judge synthesis step.
 */

/**
 * Extract the assistant text from a chat completion JSON response.
 * @param {Response} response
 * @returns {Promise<string|null>}
 */
async function extractResponseContent(response) {
  try {
    const data = await response.clone().json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a judge request that asks the judge to synthesize the best answer.
 * @param {Object} originalBody
 * @param {string} judgeModel
 * @param {Array<{label: string, content: string}>} answers
 * @returns {Object}
 */
function buildJudgeBody(originalBody, judgeModel, answers) {
  const instruction = `Several models were asked to answer the user's request. Here are their anonymized responses:

${answers.map(a => `### ${a.label}\n${a.content}`).join("\n\n")}

Please synthesize the best answer. Pick the strongest response, or combine the best parts into a single clear answer. Do not mention the model names or that this was a fusion. Just provide the final answer to the user.`;

  return {
    ...originalBody,
    model: judgeModel,
    stream: false,
    messages: [
      ...(originalBody.messages || []),
      { role: "user", content: instruction },
    ],
  };
}

/**
 * Handle fusion combo strategy: send request to all models in parallel, then
 * ask a judge model to synthesize the best answer from the successful responses.
 *
 * @param {Object} options
 * @param {Object} options.body - Request body
 * @param {string[]} options.models - Array of model strings to try
 * @param {Function} options.handleSingleModel - Function to handle single model: (body, modelStr) => Promise<Response>
 * @param {Object} options.log - Logger object
 * @param {string} [options.comboName] - Name of the combo
 * @param {string} [options.fusionJudgeModel] - Model to use as judge (defaults to first model in combo)
 * @returns {Promise<Response>}
 */
export async function handleFusionChat({ body, models, handleSingleModel, log, comboName, fusionJudgeModel }) {
  const nonStreamBody = { ...body, stream: false };
  const judgeModel = fusionJudgeModel || models[0];

  log.info("COMBO", `Fusion strategy: sending to ${models.length} models in parallel`, { comboName, judgeModel });

  const results = await Promise.allSettled(
    models.map(modelStr => handleSingleModel(nonStreamBody, modelStr)),
  );

  const successfulAnswers = [];
  let lastError = null;
  let lastStatus = null;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const modelStr = models[i];

    if (result.status === "rejected") {
      const err = result.reason?.message || String(result.reason);
      lastError = err;
      lastStatus = 500;
      log.warn("COMBO", `Fusion model ${modelStr} threw error`, { error: err });
      continue;
    }

    const response = result.value;
    if (!response.ok) {
      let errorText = response.statusText || "";
      try {
        const errorBody = await response.clone().json();
        errorText = errorBody?.error?.message || errorBody?.error || errorBody?.message || errorText;
      } catch {
        // Ignore parse errors
      }
      if (typeof errorText !== "string") {
        try { errorText = JSON.stringify(errorText); } catch { errorText = String(errorText); }
      }
      lastError = errorText || String(response.status);
      lastStatus = response.status;
      log.warn("COMBO", `Fusion model ${modelStr} returned error`, { status: response.status, reason: errorText });
      continue;
    }

    const content = await extractResponseContent(response);
    if (content === null || content === "") {
      log.warn("COMBO", `Fusion model ${modelStr} returned empty/invalid content`);
      continue;
    }

    const label = `Model ${String.fromCharCode(65 + successfulAnswers.length)}`;
    successfulAnswers.push({ model: modelStr, label, content, response });
  }

  if (successfulAnswers.length === 0) {
    const status = lastStatus || 503;
    const msg = lastError || "All fusion models failed";
    log.warn("COMBO", `All fusion models failed | ${msg}`);
    return new Response(
      JSON.stringify({ error: { message: msg } }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }

  if (successfulAnswers.length === 1) {
    log.info("COMBO", `Single fusion model succeeded (${successfulAnswers[0].model}), returning its response`);
    return successfulAnswers[0].response;
  }

  log.info("COMBO", `${successfulAnswers.length} fusion models succeeded, asking judge ${judgeModel} to synthesize`);

  const judgeBody = buildJudgeBody(
    body,
    judgeModel,
    successfulAnswers.map(a => ({ label: a.label, content: a.content })),
  );

  try {
    const judgeResponse = await handleSingleModel(judgeBody, judgeModel);
    if (judgeResponse.ok) {
      return judgeResponse;
    }

    let errorText = judgeResponse.statusText || "";
    try {
      const errorBody = await judgeResponse.clone().json();
      errorText = errorBody?.error?.message || errorBody?.error || errorBody?.message || errorText;
    } catch {
      // Ignore parse errors
    }
    log.warn("COMBO", `Fusion judge ${judgeModel} failed, returning first successful response`, { status: judgeResponse.status, reason: errorText });
  } catch (error) {
    const err = error?.message || String(error);
    log.warn("COMBO", `Fusion judge ${judgeModel} threw error, returning first successful response`, { error: err });
  }

  return successfulAnswers[0].response;
}

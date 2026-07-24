/** Assembled PROVIDERS from per-provider registry modules. */
import p_claude from "./registry/claude.js";
import p_gemini from "./registry/gemini.js";
import p_gemini_cli from "./registry/gemini-cli.js";
import p_codex from "./registry/codex.js";
import p_qwen from "./registry/qwen.js";
import p_iflow from "./registry/iflow.js";
import p_qoder from "./registry/qoder.js";
import p_antigravity from "./registry/antigravity.js";
import p_openrouter from "./registry/openrouter.js";
import p_openai from "./registry/openai.js";
import p_qwencoder from "./registry/qwencoder.js";
import p_vercel_ai_gateway from "./registry/vercel-ai-gateway.js";
import p_glm from "./registry/glm.js";
import p_glm_cn from "./registry/glm-cn.js";
import p_kimi from "./registry/kimi.js";
import p_minimax from "./registry/minimax.js";
import p_minimax_cn from "./registry/minimax-cn.js";
import p_alicode from "./registry/alicode.js";
import p_alicode_intl from "./registry/alicode-intl.js";
import p_volcengine_ark from "./registry/volcengine-ark.js";
import p_byteplus from "./registry/byteplus.js";
import p_github from "./registry/github.js";
import p_kiro from "./registry/kiro.js";
import p_amazon_q from "./registry/amazon-q.js";
import p_cursor from "./registry/cursor.js";
import p_kimi_coding from "./registry/kimi-coding.js";
import p_kilocode from "./registry/kilocode.js";
import p_opencode from "./registry/opencode.js";
import p_cline from "./registry/cline.js";
import p_nvidia from "./registry/nvidia.js";
import p_anthropic from "./registry/anthropic.js";
import p_deepseek from "./registry/deepseek.js";
import p_commandcode from "./registry/commandcode.js";
import p_groq from "./registry/groq.js";
import p_xai from "./registry/xai.js";
import p_mistral from "./registry/mistral.js";
import p_perplexity from "./registry/perplexity.js";
import p_together from "./registry/together.js";
import p_fireworks from "./registry/fireworks.js";
import p_cerebras from "./registry/cerebras.js";
import p_cohere from "./registry/cohere.js";
import p_nebius from "./registry/nebius.js";
import p_siliconflow from "./registry/siliconflow.js";
import p_hyperbolic from "./registry/hyperbolic.js";
import p_deepgram from "./registry/deepgram.js";
import p_assemblyai from "./registry/assemblyai.js";
import p_nanobanana from "./registry/nanobanana.js";
import p_chutes from "./registry/chutes.js";
import p_ollama from "./registry/ollama.js";
import p_ollama_local from "./registry/ollama-local.js";
import p_vertex from "./registry/vertex.js";
import p_vertex_partner from "./registry/vertex-partner.js";
import p_gitlab from "./registry/gitlab.js";
import p_codebuddy from "./registry/codebuddy.js";
import p_opencode_go from "./registry/opencode-go.js";
import p_grok_web from "./registry/grok-web.js";
import p_perplexity_web from "./registry/perplexity-web.js";
import p_duckduckgo_web from "./registry/duckduckgo-web.js";
import p_chatgpt_web from "./registry/chatgpt-web.js";
import p_gemini_web from "./registry/gemini-web.js";
import p_claude_web from "./registry/claude-web.js";
import p_deepseek_web from "./registry/deepseek-web.js";
import p_copilot_web from "./registry/copilot-web.js";
import p_blackbox_web from "./registry/blackbox-web.js";
import p_muse_spark_web from "./registry/muse-spark-web.js";
import p_t3_web from "./registry/t3-web.js";
import p_inner_ai from "./registry/inner-ai.js";
import p_adapta_web from "./registry/adapta-web.js";
import p_huggingchat from "./registry/huggingchat.js";
import p_phind from "./registry/phind.js";
import p_poe_web from "./registry/poe-web.js";
import p_venice_web from "./registry/venice-web.js";
import p_v0_vercel_web from "./registry/v0-vercel-web.js";
import p_kimi_web from "./registry/kimi-web.js";
import p_doubao_web from "./registry/doubao-web.js";
import p_veoaifree_web from "./registry/veoaifree-web.js";
import p_cliproxyapi from "./registry/cliproxyapi.js";
import p_9router from "./registry/9router.js";
import p_jules from "./registry/jules.js";
import p_devin from "./registry/devin.js";
import p_devin_cli from "./registry/devin-cli.js";
import p_codex_cloud from "./registry/codex-cloud.js";
import p_suno from "./registry/suno.js";
import p_udio from "./registry/udio.js";
import p_azure from "./registry/azure.js";
import p_cloudflare_ai from "./registry/cloudflare-ai.js";
import p_xiaomi_mimo from "./registry/xiaomi-mimo.js";
import p_xiaomi_tokenplan from "./registry/xiaomi-tokenplan.js";
import p_agentrouter from "./registry/agentrouter.js";
import p_aimlapi from "./registry/aimlapi.js";
import p_novita from "./registry/novita.js";
import p_modal from "./registry/modal.js";
import p_reka from "./registry/reka.js";
import p_nlpcloud from "./registry/nlpcloud.js";
import p_bazaarlink from "./registry/bazaarlink.js";
import p_completions from "./registry/completions.js";
import p_enally from "./registry/enally.js";
import p_freetheai from "./registry/freetheai.js";
import p_llm7 from "./registry/llm7.js";
import p_lepton from "./registry/lepton.js";
import p_kluster from "./registry/kluster.js";
import p_ai21 from "./registry/ai21.js";
import p_inference_net from "./registry/inference-net.js";
import p_predibase from "./registry/predibase.js";
import p_bytez from "./registry/bytez.js";
import p_morph from "./registry/morph.js";
import p_longcat from "./registry/longcat.js";
import p_puter from "./registry/puter.js";
import p_uncloseai from "./registry/uncloseai.js";
import p_scaleway from "./registry/scaleway.js";
import p_deepinfra from "./registry/deepinfra.js";
import p_sambanova from "./registry/sambanova.js";
import p_nscale from "./registry/nscale.js";
import p_baseten from "./registry/baseten.js";
import p_publicai from "./registry/publicai.js";
import p_nous_research from "./registry/nous-research.js";
import p_glhf from "./registry/glhf.js";
import p_blackbox from "./registry/blackbox.js";
import p_api_airforce from "./registry/api-airforce.js";
import p_astraflow from "./registry/astraflow.js";
import p_astraflow_cn from "./registry/astraflow-cn.js";
import p_qianfan from "./registry/qianfan.js";
import p_crof from "./registry/crof.js";
import p_zai from "./registry/zai.js";
import p_github_models from "./registry/github-models.js";
import p_ollama_cloud from "./registry/ollama-cloud.js";
import p_synthetic from "./registry/synthetic.js";
import p_kilo_gateway from "./registry/kilo-gateway.js";
import p_opencode_zen from "./registry/opencode-zen.js";
import p_meta_llama from "./registry/meta-llama.js";
import p_moonshot from "./registry/moonshot.js";
import p_ovhcloud from "./registry/ovhcloud.js";
import p_lambda_ai from "./registry/lambda-ai.js";
import p_featherless_ai from "./registry/featherless-ai.js";
import p_friendliai from "./registry/friendliai.js";
import p_llamagate from "./registry/llamagate.js";
import p_gigachat from "./registry/gigachat.js";
import p_venice from "./registry/venice.js";
import p_codestral from "./registry/codestral.js";
import p_upstage from "./registry/upstage.js";
import p_maritalk from "./registry/maritalk.js";
import p_nanogpt from "./registry/nanogpt.js";
import p_piapi from "./registry/piapi.js";
import p_getgoapi from "./registry/getgoapi.js";
import p_laozhang from "./registry/laozhang.js";
import p_cablyai from "./registry/cablyai.js";
import p_thebai from "./registry/thebai.js";
import p_fenayai from "./registry/fenayai.js";
import p_empower from "./registry/empower.js";
import p_poe from "./registry/poe.js";
import p_galadriel from "./registry/galadriel.js";
import p_wandb from "./registry/wandb.js";
import p_volcengine from "./registry/volcengine.js";
import p_gitlawb from "./registry/gitlawb.js";
import p_gitlawb_gmi from "./registry/gitlawb-gmi.js";
import p_bluesminds from "./registry/bluesminds.js";
import p_freemodel_dev from "./registry/freemodel-dev.js";
import p_freeaiapikey from "./registry/freeaiapikey.js";
import p_kie from "./registry/kie.js";
import p_hackclub from "./registry/hackclub.js";
import p_pollinations from "./registry/pollinations.js";
import p_replicate from "./registry/replicate.js";
import p_poolside from "./registry/poolside.js";
import p_arcee_ai from "./registry/arcee-ai.js";
import p_inclusionai from "./registry/inclusionai.js";
import p_liquid from "./registry/liquid.js";
import p_nomic from "./registry/nomic.js";
import p_krutrim from "./registry/krutrim.js";
import p_monsterapi from "./registry/monsterapi.js";
import p_dify from "./registry/dify.js";
import p_tokenrouter from "./registry/tokenrouter.js";
import p_requesty from "./registry/requesty.js";
import p_zenmux from "./registry/zenmux.js";
import p_dgrid from "./registry/dgrid.js";
import p_orcarouter from "./registry/orcarouter.js";
import p_modelscope from "./registry/modelscope.js";
import p_digitalocean from "./registry/digitalocean.js";
import p_alibaba from "./registry/alibaba.js";
import p_alibaba_cn from "./registry/alibaba-cn.js";
import p_bailian_coding_plan from "./registry/bailian-coding-plan.js";
import p_hcnsec from "./registry/hcnsec.js";
import p_glmt from "./registry/glmt.js";
import p_sparkdesk from "./registry/sparkdesk.js";
import p_openvecta from "./registry/openvecta.js";
import p_sumopod from "./registry/sumopod.js";
import p_kenari from "./registry/kenari.js";
import p_x5lab from "./registry/x5lab.js";
import p_wafer from "./registry/wafer.js";
import p_nube from "./registry/nube.js";
import p_qiniu from "./registry/qiniu.js";
import p_factory from "./registry/factory.js";
import p_openadapter from "./registry/openadapter.js";
import p_pioneer from "./registry/pioneer.js";
import p_charm_hyper from "./registry/charm-hyper.js";
import p_dit from "./registry/dit.js";
import p_bai from "./registry/bai.js";
import p_v0_vercel from "./registry/v0-vercel.js";
import p_codebuddy_cn from "./registry/codebuddy-cn.js";
import p_kimi_coding_apikey from "./registry/kimi-coding-apikey.js";
import p_theoldllm from "./registry/theoldllm.js";
import p_mimocode from "./registry/mimocode.js";
import p_auggie from "./registry/auggie.js";
import p_zenmux_free from "./registry/zenmux-free.js";
import p_yuanbao_web from "./registry/yuanbao-web.js";
import p_zai_web from "./registry/zai-web.js";
import p_qwen_web from "./registry/qwen-web.js";
import p_copilot_m365_web from "./registry/copilot-m365-web.js";
import p_lmarena from "./registry/lmarena.js";
import p_baidu from "./registry/baidu.js";
import p_tencent from "./registry/tencent.js";
import p_iflytek from "./registry/iflytek.js";
import p_baichuan from "./registry/baichuan.js";
import p_yi from "./registry/yi.js";
import p_stepfun from "./registry/stepfun.js";
import p_360ai from "./registry/360ai.js";
import p_sensenova from "./registry/sensenova.js";
import p_doubao from "./registry/doubao.js";
import p_coze from "./registry/coze.js";
import p_azure_ai from "./registry/azure-ai.js";
import p_watsonx from "./registry/watsonx.js";
import p_oci from "./registry/oci.js";
import p_sap from "./registry/sap.js";
import p_databricks from "./registry/databricks.js";
import p_datarobot from "./registry/datarobot.js";
import p_clarifai from "./registry/clarifai.js";
import p_snowflake from "./registry/snowflake.js";
import p_heroku from "./registry/heroku.js";
import p_lm_studio from "./registry/lm-studio.js";
import p_vllm from "./registry/vllm.js";
import p_lemonade from "./registry/lemonade.js";
import p_llamafile from "./registry/llamafile.js";
import p_llama_cpp from "./registry/llama-cpp.js";
import p_triton from "./registry/triton.js";
import p_docker_model_runner from "./registry/docker-model-runner.js";
import p_xinference from "./registry/xinference.js";
import p_oobabooga from "./registry/oobabooga.js";
import p_ideogram from "./registry/ideogram.js";
import p_leonardo from "./registry/leonardo.js";
import p_haiper from "./registry/haiper.js";
import p_bedrock from "./registry/bedrock.js";
import p_agnes from "./registry/agnes.js";
import p_aihorde from "./registry/aihorde.js";
import p_ainative from "./registry/ainative.js";
import p_aion from "./registry/aion.js";
import p_ant_ling from "./registry/ant-ling.js";
import p_chenzk from "./registry/chenzk.js";
import p_chipotle from "./registry/chipotle.js";
import p_clova_studio from "./registry/clova-studio.js";
import p_dahl from "./registry/dahl.js";
import p_felo_web from "./registry/felo-web.js";
import p_freepik from "./registry/freepik.js";
import p_g4f_gemini from "./registry/g4f-gemini.js";
import p_g4f_groq from "./registry/g4f-groq.js";
import p_g4f_nvidia from "./registry/g4f-nvidia.js";
import p_g4f_ollama from "./registry/g4f-ollama.js";
import p_g4f_pollinations from "./registry/g4f-pollinations.js";
import p_ghe_copilot from "./registry/ghe-copilot.js";
import p_hyperagent from "./registry/hyperagent.js";
import p_inception from "./registry/inception.js";
import p_internlm from "./registry/internlm.js";
import p_nara from "./registry/nara.js";
import p_navy from "./registry/navy.js";
import p_notion_web from "./registry/notion-web.js";
import p_plamo from "./registry/plamo.js";
import p_promptql from "./registry/promptql.js";
import p_qwen_cloud from "./registry/qwen-cloud.js";
import p_qwen_cloud_token_plan from "./registry/qwen-cloud-token-plan.js";
import p_routeway from "./registry/routeway.js";
import p_sarvam from "./registry/sarvam.js";
import p_sealion from "./registry/sealion.js";
import p_typhoon from "./registry/typhoon.js";
import p_writer from "./registry/writer.js";
import p_xai_oauth from "./registry/xai-oauth.js";
import p_agy from "./registry/agy.js";
import p_clinepass from "./registry/clinepass.js";
import p_grok_cli from "./registry/grok-cli.js";
import p_huggingface from "./registry/huggingface.js";
import p_trae from "./registry/trae.js";
import p_windsurf from "./registry/windsurf.js";
import p_zed_hosted from "./registry/zed-hosted.js";
import p_command_code from "./registry/command-code.js";
import p_gitlab_duo from "./registry/gitlab-duo.js";

export const PROVIDERS = {
  "claude": p_claude,
  "gemini": p_gemini,
  "gemini-cli": p_gemini_cli,
  "codex": p_codex,
  "qwen": p_qwen,
  "iflow": p_iflow,
  "qoder": p_qoder,
  "antigravity": p_antigravity,
  "openrouter": p_openrouter,
  "openai": p_openai,
  "qwencoder": p_qwencoder,
  "vercel-ai-gateway": p_vercel_ai_gateway,
  "glm": p_glm,
  "glm-cn": p_glm_cn,
  "kimi": p_kimi,
  "minimax": p_minimax,
  "minimax-cn": p_minimax_cn,
  "alicode": p_alicode,
  "alicode-intl": p_alicode_intl,
  "volcengine-ark": p_volcengine_ark,
  "byteplus": p_byteplus,
  "github": p_github,
  "kiro": p_kiro,
  "amazon-q": p_amazon_q,
  "cursor": p_cursor,
  "kimi-coding": p_kimi_coding,
  "kilocode": p_kilocode,
  "opencode": p_opencode,
  "cline": p_cline,
  "nvidia": p_nvidia,
  "anthropic": p_anthropic,
  "deepseek": p_deepseek,
  "commandcode": p_commandcode,
  "groq": p_groq,
  "xai": p_xai,
  "mistral": p_mistral,
  "perplexity": p_perplexity,
  "together": p_together,
  "fireworks": p_fireworks,
  "cerebras": p_cerebras,
  "cohere": p_cohere,
  "nebius": p_nebius,
  "siliconflow": p_siliconflow,
  "hyperbolic": p_hyperbolic,
  "deepgram": p_deepgram,
  "assemblyai": p_assemblyai,
  "nanobanana": p_nanobanana,
  "chutes": p_chutes,
  "ollama": p_ollama,
  "ollama-local": p_ollama_local,
  "vertex": p_vertex,
  "vertex-partner": p_vertex_partner,
  "gitlab": p_gitlab,
  "codebuddy": p_codebuddy,
  "opencode-go": p_opencode_go,
  "grok-web": p_grok_web,
  "perplexity-web": p_perplexity_web,
  "duckduckgo-web": p_duckduckgo_web,
  "chatgpt-web": p_chatgpt_web,
  "gemini-web": p_gemini_web,
  "claude-web": p_claude_web,
  "deepseek-web": p_deepseek_web,
  "copilot-web": p_copilot_web,
  "blackbox-web": p_blackbox_web,
  "muse-spark-web": p_muse_spark_web,
  "t3-web": p_t3_web,
  "inner-ai": p_inner_ai,
  "adapta-web": p_adapta_web,
  "huggingchat": p_huggingchat,
  "phind": p_phind,
  "poe-web": p_poe_web,
  "venice-web": p_venice_web,
  "v0-vercel-web": p_v0_vercel_web,
  "kimi-web": p_kimi_web,
  "doubao-web": p_doubao_web,
  "veoaifree-web": p_veoaifree_web,
  "cliproxyapi": p_cliproxyapi,
  "9router": p_9router,
  "jules": p_jules,
  "devin": p_devin,
  "devin-cli": p_devin_cli,
  "codex-cloud": p_codex_cloud,
  "suno": p_suno,
  "udio": p_udio,
  "azure": p_azure,
  "cloudflare-ai": p_cloudflare_ai,
  "xiaomi-mimo": p_xiaomi_mimo,
  "xiaomi-tokenplan": p_xiaomi_tokenplan,
  "agentrouter": p_agentrouter,
  "aimlapi": p_aimlapi,
  "novita": p_novita,
  "modal": p_modal,
  "reka": p_reka,
  "nlpcloud": p_nlpcloud,
  "bazaarlink": p_bazaarlink,
  "completions": p_completions,
  "enally": p_enally,
  "freetheai": p_freetheai,
  "llm7": p_llm7,
  "lepton": p_lepton,
  "kluster": p_kluster,
  "ai21": p_ai21,
  "inference-net": p_inference_net,
  "predibase": p_predibase,
  "bytez": p_bytez,
  "morph": p_morph,
  "longcat": p_longcat,
  "puter": p_puter,
  "uncloseai": p_uncloseai,
  "scaleway": p_scaleway,
  "deepinfra": p_deepinfra,
  "sambanova": p_sambanova,
  "nscale": p_nscale,
  "baseten": p_baseten,
  "publicai": p_publicai,
  "nous-research": p_nous_research,
  "glhf": p_glhf,
  "blackbox": p_blackbox,
  "api-airforce": p_api_airforce,
  "astraflow": p_astraflow,
  "astraflow-cn": p_astraflow_cn,
  "qianfan": p_qianfan,
  "crof": p_crof,
  "zai": p_zai,
  "github-models": p_github_models,
  "ollama-cloud": p_ollama_cloud,
  "synthetic": p_synthetic,
  "kilo-gateway": p_kilo_gateway,
  "opencode-zen": p_opencode_zen,
  "meta-llama": p_meta_llama,
  "moonshot": p_moonshot,
  "ovhcloud": p_ovhcloud,
  "lambda-ai": p_lambda_ai,
  "featherless-ai": p_featherless_ai,
  "friendliai": p_friendliai,
  "llamagate": p_llamagate,
  "gigachat": p_gigachat,
  "venice": p_venice,
  "codestral": p_codestral,
  "upstage": p_upstage,
  "maritalk": p_maritalk,
  "nanogpt": p_nanogpt,
  "piapi": p_piapi,
  "getgoapi": p_getgoapi,
  "laozhang": p_laozhang,
  "cablyai": p_cablyai,
  "thebai": p_thebai,
  "fenayai": p_fenayai,
  "empower": p_empower,
  "poe": p_poe,
  "galadriel": p_galadriel,
  "wandb": p_wandb,
  "volcengine": p_volcengine,
  "gitlawb": p_gitlawb,
  "gitlawb-gmi": p_gitlawb_gmi,
  "bluesminds": p_bluesminds,
  "freemodel-dev": p_freemodel_dev,
  "freeaiapikey": p_freeaiapikey,
  "kie": p_kie,
  "hackclub": p_hackclub,
  "pollinations": p_pollinations,
  "replicate": p_replicate,
  "poolside": p_poolside,
  "arcee-ai": p_arcee_ai,
  "inclusionai": p_inclusionai,
  "liquid": p_liquid,
  "nomic": p_nomic,
  "krutrim": p_krutrim,
  "monsterapi": p_monsterapi,
  "dify": p_dify,
  "tokenrouter": p_tokenrouter,
  "requesty": p_requesty,
  "zenmux": p_zenmux,
  "dgrid": p_dgrid,
  "orcarouter": p_orcarouter,
  "modelscope": p_modelscope,
  "digitalocean": p_digitalocean,
  "alibaba": p_alibaba,
  "alibaba-cn": p_alibaba_cn,
  "bailian-coding-plan": p_bailian_coding_plan,
  "hcnsec": p_hcnsec,
  "glmt": p_glmt,
  "sparkdesk": p_sparkdesk,
  "openvecta": p_openvecta,
  "sumopod": p_sumopod,
  "kenari": p_kenari,
  "x5lab": p_x5lab,
  "wafer": p_wafer,
  "nube": p_nube,
  "qiniu": p_qiniu,
  "factory": p_factory,
  "openadapter": p_openadapter,
  "pioneer": p_pioneer,
  "charm-hyper": p_charm_hyper,
  "dit": p_dit,
  "bai": p_bai,
  "v0-vercel": p_v0_vercel,
  "codebuddy-cn": p_codebuddy_cn,
  "kimi-coding-apikey": p_kimi_coding_apikey,
  "theoldllm": p_theoldllm,
  "mimocode": p_mimocode,
  "auggie": p_auggie,
  "zenmux-free": p_zenmux_free,
  "yuanbao-web": p_yuanbao_web,
  "zai-web": p_zai_web,
  "qwen-web": p_qwen_web,
  "copilot-m365-web": p_copilot_m365_web,
  "lmarena": p_lmarena,
  "baidu": p_baidu,
  "tencent": p_tencent,
  "iflytek": p_iflytek,
  "baichuan": p_baichuan,
  "yi": p_yi,
  "stepfun": p_stepfun,
  "360ai": p_360ai,
  "sensenova": p_sensenova,
  "doubao": p_doubao,
  "coze": p_coze,
  "azure-ai": p_azure_ai,
  "watsonx": p_watsonx,
  "oci": p_oci,
  "sap": p_sap,
  "databricks": p_databricks,
  "datarobot": p_datarobot,
  "clarifai": p_clarifai,
  "snowflake": p_snowflake,
  "heroku": p_heroku,
  "lm-studio": p_lm_studio,
  "vllm": p_vllm,
  "lemonade": p_lemonade,
  "llamafile": p_llamafile,
  "llama-cpp": p_llama_cpp,
  "triton": p_triton,
  "docker-model-runner": p_docker_model_runner,
  "xinference": p_xinference,
  "oobabooga": p_oobabooga,
  "ideogram": p_ideogram,
  "leonardo": p_leonardo,
  "haiper": p_haiper,
  "bedrock": p_bedrock,

  "agnes": p_agnes,
  "aihorde": p_aihorde,
  "ainative": p_ainative,
  "aion": p_aion,
  "ant-ling": p_ant_ling,
  "chenzk": p_chenzk,
  "chipotle": p_chipotle,
  "clova-studio": p_clova_studio,
  "dahl": p_dahl,
  "felo-web": p_felo_web,
  "freepik": p_freepik,
  "g4f-gemini": p_g4f_gemini,
  "g4f-groq": p_g4f_groq,
  "g4f-nvidia": p_g4f_nvidia,
  "g4f-ollama": p_g4f_ollama,
  "g4f-pollinations": p_g4f_pollinations,
  "ghe-copilot": p_ghe_copilot,
  "hyperagent": p_hyperagent,
  "inception": p_inception,
  "internlm": p_internlm,
  "nara": p_nara,
  "navy": p_navy,
  "notion-web": p_notion_web,
  "plamo": p_plamo,
  "promptql": p_promptql,
  "qwen-cloud": p_qwen_cloud,
  "qwen-cloud-token-plan": p_qwen_cloud_token_plan,
  "routeway": p_routeway,
  "sarvam": p_sarvam,
  "sealion": p_sealion,
  "typhoon": p_typhoon,
  "writer": p_writer,
  "xai-oauth": p_xai_oauth,

  "agy": p_agy,
  "clinepass": p_clinepass,
  "grok-cli": p_grok_cli,
  "huggingface": p_huggingface,
  "trae": p_trae,
  "windsurf": p_windsurf,
  "zed-hosted": p_zed_hosted,
  "command-code": p_command_code,
  "gitlab-duo": p_gitlab_duo,
};


export const OLLAMA_LOCAL_DEFAULT_HOST = "http://localhost:11434";

export function resolveOllamaLocalHost(credentials) {
  const raw = credentials?.providerSpecificData?.baseUrl?.trim();
  return (raw || OLLAMA_LOCAL_DEFAULT_HOST).replace(/\/$/, "");
}

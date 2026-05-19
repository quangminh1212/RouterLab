package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"xlabrouter-go/internal/store"
)

type Forwarder struct {
	client *http.Client
	store  *store.Store
}

func NewForwarder(st *store.Store) *Forwarder {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConns = 256
	transport.MaxIdleConnsPerHost = 64
	transport.MaxConnsPerHost = 128
	transport.IdleConnTimeout = 90 * time.Second

	return &Forwarder{
		client: &http.Client{Transport: transport, Timeout: 240 * time.Second},
		store:  st,
	}
}

func resolveEndpoint(c store.ProviderConnection, model string) (string, string, error) {
	baseURL := ""
	if c.ProviderSpecificData != nil {
		if v, ok := c.ProviderSpecificData["baseUrl"].(string); ok && strings.TrimSpace(v) != "" {
			baseURL = strings.TrimRight(strings.TrimSpace(v), "/")
		}
	}
	if baseURL == "" {
		switch c.Provider {
		case "openai":
			baseURL = "https://api.openai.com"
		case "anthropic":
			baseURL = "https://api.anthropic.com"
		case "openrouter":
			baseURL = "https://openrouter.ai/api"
		default:
			return "", "", fmt.Errorf("provider %s missing baseUrl", c.Provider)
		}
	}

	if strings.Contains(model, "claude") || c.Provider == "anthropic" {
		return baseURL + "/v1/messages", "anthropic", nil
	}
	return baseURL + "/v1/chat/completions", "openai", nil
}

func setAuthHeader(req *http.Request, c store.ProviderConnection, mode string) {
	if c.AuthType == "cookie" {
		if c.APIKey != "" {
			req.Header.Set("Cookie", c.APIKey)
		}
		return
	}
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	if c.AccessToken != "" && c.APIKey == "" {
		req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	}
	if mode == "anthropic" {
		req.Header.Set("anthropic-version", "2023-06-01")
	}
}

func extractModel(body map[string]interface{}) string {
	if v, ok := body["model"].(string); ok {
		return v
	}
	return ""
}

func (f *Forwarder) ForwardChat(ctx context.Context, requestBody []byte) (int, []byte, http.Header, error) {
	var body map[string]interface{}
	if err := json.Unmarshal(requestBody, &body); err != nil {
		return http.StatusBadRequest, nil, nil, fmt.Errorf("invalid json: %w", err)
	}

	model := extractModel(body)
	providerHint := ""
	if strings.Contains(model, "/") {
		providerHint = strings.SplitN(model, "/", 2)[0]
	}

	candidates := f.store.GetActiveConnections(providerHint)
	if len(candidates) == 0 && providerHint != "" {
		candidates = f.store.GetActiveConnections("")
	}
	if len(candidates) == 0 {
		return http.StatusBadGateway, nil, nil, fmt.Errorf("no active provider connections")
	}

	var lastErr error
	for _, c := range candidates {
		endpoint, mode, err := resolveEndpoint(c, model)
		if err != nil {
			lastErr = err
			continue
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(requestBody))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		setAuthHeader(req, c, mode)

		resp, err := f.client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		respBody, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}

		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("upstream %s status %d", c.Provider, resp.StatusCode)
			continue
		}
		return resp.StatusCode, respBody, resp.Header, nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("all providers failed")
	}
	return http.StatusBadGateway, nil, nil, lastErr
}

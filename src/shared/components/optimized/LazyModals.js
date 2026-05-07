"use client";

import dynamic from "next/dynamic";
import { memo } from "react";

const DynamicChangelogModal = dynamic(() => import("../ChangelogModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicOAuthModal = dynamic(() => import("../OAuthModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicCursorAuthModal = dynamic(() => import("../CursorAuthModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicKiroAuthModal = dynamic(() => import("../KiroAuthModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicGitLabAuthModal = dynamic(() => import("../GitLabAuthModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicPricingModal = dynamic(() => import("../PricingModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicModelSelectModal = dynamic(() => import("../ModelSelectModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicEditConnectionModal = dynamic(() => import("../EditConnectionModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicRamConfigModal = dynamic(() => import("../RamConfigModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicKiroSocialOAuthModal = dynamic(() => import("../KiroSocialOAuthModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicAddCustomEmbeddingModal = dynamic(() => import("../AddCustomEmbeddingModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicNineRemotePromoModal = dynamic(() => import("../NineRemotePromoModal"), {
  ssr: false,
  loading: () => null,
});

const DynamicIFlowCookieModal = dynamic(() => import("../IFlowCookieModal"), {
  ssr: false,
  loading: () => null,
});

export const LazyChangelogModal = memo(DynamicChangelogModal);
export const LazyOAuthModal = memo(DynamicOAuthModal);
export const LazyCursorAuthModal = memo(DynamicCursorAuthModal);
export const LazyKiroAuthModal = memo(DynamicKiroAuthModal);
export const LazyGitLabAuthModal = memo(DynamicGitLabAuthModal);
export const LazyPricingModal = memo(DynamicPricingModal);
export const LazyModelSelectModal = memo(DynamicModelSelectModal);
export const LazyEditConnectionModal = memo(DynamicEditConnectionModal);
export const LazyRamConfigModal = memo(DynamicRamConfigModal);
export const LazyKiroSocialOAuthModal = memo(DynamicKiroSocialOAuthModal);
export const LazyAddCustomEmbeddingModal = memo(DynamicAddCustomEmbeddingModal);
export const LazyNineRemotePromoModal = memo(DynamicNineRemotePromoModal);
export const LazyIFlowCookieModal = memo(DynamicIFlowCookieModal);

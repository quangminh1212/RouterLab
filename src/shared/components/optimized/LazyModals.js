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

export const LazyChangelogModal = memo(DynamicChangelogModal);
export const LazyOAuthModal = memo(DynamicOAuthModal);
export const LazyCursorAuthModal = memo(DynamicCursorAuthModal);
export const LazyKiroAuthModal = memo(DynamicKiroAuthModal);
export const LazyGitLabAuthModal = memo(DynamicGitLabAuthModal);
export const LazyPricingModal = memo(DynamicPricingModal);
export const LazyModelSelectModal = memo(DynamicModelSelectModal);
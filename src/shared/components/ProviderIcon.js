"use client";

import { useState } from "react";
import PropTypes from "prop-types";

export default function ProviderIcon({
  src,
  alt,
  size = 32,
  className = "",
  fallbackText = "?",
  fallbackColor,
}) {
  const sources = Array.isArray(src) ? src.filter(Boolean) : (src ? [src] : []);
  const sourceKey = sources.join("|");
  const [imageState, setImageState] = useState({ sourceKey, sourceIndex: 0, errored: false });
  const activeImageState = imageState.sourceKey === sourceKey
    ? imageState
    : { sourceKey, sourceIndex: 0, errored: false };
  const currentSrc = sources[activeImageState.sourceIndex] || "";

  if (!currentSrc || activeImageState.errored) {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold rounded-lg ${className}`.trim()}
        style={{
          width: size,
          height: size,
          color: fallbackColor,
          fontSize: Math.max(10, Math.floor(size * 0.38)),
        }}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => {
        if (activeImageState.sourceIndex < sources.length - 1) {
          setImageState({
            sourceKey,
            sourceIndex: activeImageState.sourceIndex + 1,
            errored: false,
          });
        } else {
          setImageState({
            sourceKey,
            sourceIndex: activeImageState.sourceIndex,
            errored: true,
          });
        }
      }}
    />
  );
}

ProviderIcon.propTypes = {
  src: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  alt: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string,
  fallbackText: PropTypes.string,
  fallbackColor: PropTypes.string,
};

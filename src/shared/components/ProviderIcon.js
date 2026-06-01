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
  contrastTile = true,
}) {
  const sources = Array.isArray(src) ? src.filter(Boolean) : (src ? [src] : []);
  const sourceKey = sources.join("|");
  const [imageState, setImageState] = useState({ sourceKey, sourceIndex: 0, errored: false });
  const activeImageState = imageState.sourceKey === sourceKey
    ? imageState
    : { sourceKey, sourceIndex: 0, errored: false };
  const currentSrc = sources[activeImageState.sourceIndex] || "";

  const tilePadding = contrastTile ? Math.max(2, Math.floor(size * 0.1)) : 0;
  const tileStyle = contrastTile
    ? {
      width: size,
      height: size,
      padding: tilePadding,
      backgroundColor: "#f8fafc",
      border: "1px solid rgba(15, 23, 42, 0.14)",
      boxSizing: "border-box",
    }
    : {
      width: size,
      height: size,
    };

  if (!currentSrc || activeImageState.errored) {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold rounded-lg ${className}`.trim()}
        style={{
          ...tileStyle,
          color: fallbackColor,
          fontSize: Math.max(10, Math.floor(size * 0.38)),
        }}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-lg ${className}`.trim()}
      style={tileStyle}
    >
      <img
        src={currentSrc}
        alt={alt}
        width={size - tilePadding * 2}
        height={size - tilePadding * 2}
        className="block max-h-full max-w-full object-contain"
        style={{ width: "100%", height: "100%" }}
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
    </span>
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
  contrastTile: PropTypes.bool,
};

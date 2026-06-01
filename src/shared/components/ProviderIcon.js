"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";

export default function ProviderIcon({
  src,
  alt,
  size = 32,
  className = "",
  fallbackText = "?",
  fallbackColor,
}) {
  const [errored, setErrored] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = Array.isArray(src) ? src.filter(Boolean) : (src ? [src] : []);
  const sourceKey = sources.join("|");
  const currentSrc = sources[sourceIndex] || "";

  useEffect(() => {
    setErrored(false);
    setSourceIndex(0);
  }, [sourceKey]);

  if (!currentSrc || errored) {
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
        if (sourceIndex < sources.length - 1) {
          setSourceIndex((index) => index + 1);
        } else {
          setErrored(true);
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

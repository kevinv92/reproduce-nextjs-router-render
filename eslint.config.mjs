import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      "react/jsx-max-depth": ["warn", { max: 6 }],
    },
  },
];

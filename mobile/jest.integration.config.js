module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/integration/processEnv.js',
  },
  transform: {
    '\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@boardzando/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
  },
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@board-games/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
  },
};

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './registry';
import type { Difficulty } from './types';

/** main의 T06a 생성 결과를 고정해 새 종류 등록으로 기존 판이 바뀌지 않는지 확인한다. */
describe('T06a 생성 결과 회귀', () => {
  it('기존 세 종류의 모든 단계에서 시드 426 판이 같다', () => {
    const fingerprints = Object.fromEntries((['sudoku', 'train', 'pyramid'] as const).flatMap(type =>
      ([1, 2, 3, 4, 5] as Difficulty[]).map(level => [`${type}:${level}`,
        createHash('sha256').update(JSON.stringify(generatePuzzle(type, level, 426))).digest('hex')])));
    expect(fingerprints).toMatchInlineSnapshot(`
      {
        "pyramid:1": "6e074803c44fe37c553a7e353847089aaee6934840df99e6c4d73b3bb603841a",
        "pyramid:2": "298701642b442b6cb293c785c38ee6d8ce0dab234eb8cad0ee6349db3553acdb",
        "pyramid:3": "fa02c220c9720702447661a56c48cdd32c44db310fea40e99d0e2a0f674a32a1",
        "pyramid:4": "3131e21ede603e86f3f3c02787fed70df0b5833930fd5113672aa584baec3080",
        "pyramid:5": "5661387f83a42336265665e03b8149c9e01e9eed35cd98b90f7d142d7a79f76b",
        "sudoku:1": "907ae7222a7ee83076eadc4c8a2ec5e6d73edfc2f142b191cc8aa57298584406",
        "sudoku:2": "ef18c8fc32e68429e357020ff1046ae51da7f55aa17db9874f9c879ab47cb3a9",
        "sudoku:3": "216adb2d66e3df20f2cad841de715047a87e01e4a237f4ed6508f9cfdd8830c6",
        "sudoku:4": "3942fe5af674bb85e047d4d89e4774324d50e6a125f72d26aa3399fee119d490",
        "sudoku:5": "31ad8ee15853c75f036fa139db49d510e91f030219b6132dc23c6fc43e7568d1",
        "train:1": "3907964859f30b4a24a985b0e4780fcb3fd074327ed5b54e61c22a77ee9e5fd4",
        "train:2": "3c5b95320070195d925b385602e2d90a58cc5c17898be93449b69220b0bf3b4c",
        "train:3": "e6cc616d16565d735332eba6606694c609e7eea361b1394c3bb1b28ad7c214c8",
        "train:4": "a57d9f3ecd47e2d146600f06302fe85add28f4f195f520adfa941daf960c3925",
        "train:5": "6b7069d7f3276b82757244c594a52efa5cbb570c4ef99863f56a4a15a7c3a29c",
      }
    `);
  });
});

import { nextColor } from './households'

test('nextColor picks the lowest unused colour, then cycles', () => {
  expect(nextColor([])).toBe(1)
  expect(nextColor([1, 2, 4])).toBe(3)
  expect(nextColor([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(1)
  expect(nextColor([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1])).toBe(2)
})

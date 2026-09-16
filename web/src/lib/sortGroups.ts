export function sortPersonFirst<T>(
  items: T[],
  isPerson: (item: T) => boolean,
  name: (item: T) => string,
  earliestStart: (item: T) => number,
): T[] {
  const people = items
    .filter(isPerson)
    .sort((a, b) => name(a).localeCompare(name(b)));
  const other = items
    .filter((item) => !isPerson(item))
    .sort((a, b) => earliestStart(a) - earliestStart(b));
  return [...people, ...other];
}

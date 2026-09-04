/** Commands whose raw REPL input can contain credentials. */
export function isSensitiveCommand(text: string): boolean {
  return /^(?:login(?:\s|$)|secret\s+set(?:\s|$))/iu.test(text.trimStart());
}

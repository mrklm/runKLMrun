/** Copier la FileList vivante avant de réinitialiser le champ pour une réimportation. */
export function takeSelectedFiles(input: Pick<HTMLInputElement, 'files' | 'value'>): File[] {
  const files = Array.from(input.files ?? []);
  input.value = '';
  return files;
}

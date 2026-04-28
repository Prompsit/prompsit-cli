# Style guide — `<locale>`

Per-locale voice contract. Copy this file to `localization/style-guide.<locale>.md` (one
per target locale) and fill every section. Sections must appear in this order; the skill
reads them positionally.

## Audience

Who reads content in this locale. One paragraph. Be specific: age range, professional
context, prior familiarity with the domain. Generic ("everyone") is not useful.

## Register

Pick one: academic / journalistic / marketing / informal. One sentence stating the choice,
then two short examples that illustrate it. Examples should be excerpts the agent can
imitate, not abstract descriptions.

## Sensitivity

Topics, framings, or words that risk reading as loaded, agitational, or politically
charged in this locale. List each as a `bad → good` pair, with a one-sentence reason.

Example:

- "war on cancer" → "fight against cancer" — military metaphors translate poorly in target
  locales where they imply state-level conflict.

## Avoid

Three to five concrete things to not do, with `bad → good` pairs.

Example:

- Anglicism overload: "хайповый продукт" → "перспективный продукт".
- Calque cognates: "actually" → "на самом деле" (NOT "актуально").
- Translator's "of": "история компании" (NOT "история о компании").

## Examples

Three to five short `source → target` pairs that exemplify the desired voice. These set
the bar; the skill uses them as positive references when generating witness and body
strings. Avoid generic textbook sentences — pull real source material from the project
where possible.

Example:

- "Build the future of AI." → "Создавайте будущее искусственного интеллекта."
- "Open source, open mind." → "Открытый код, открытый ум."

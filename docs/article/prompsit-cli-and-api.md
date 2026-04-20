**Prompsit’s API and CLI: planet-friendly, privacy-first, open-source translation services for everyone**

| Lev Nikolaevich Berezhnoy, Gema Ramírez-Sánchez, Sergio Ortiz-Rojas,  Mikel L. Forcada Prompsit Language Engineering Edif. Quorum III, Avinguda de la Universitat, s/n,  E-03202 Elx {levnikolaevich,gramirez,sergio,mlf}@prompsit.com |
| :---: |

**Abstract**

Prompsit Language Engineering is launching an updated API and CLI for its open-source, planet-friendly machine translation services. Operating on a freemium model, the tools offer free limited access alongside tiered pricing for advanced features like MT evaluation, quality estimation, corpus scoring, and multilingual dataset annotation.

# **1 A classical MT service in 2026?**

While large language models (LLMs) offer impressive linguistic flair, classical transformer-based neural machine translation (NMT) —whether standalone or in hybrid workflows— remains the proven backbone for high-volume  professional translation due to its predictability, cost-efficiency and speed. NMT is significantly faster —often processing content orders of magnitude quicker than LLMs— and allows for a transparent, character-based pricing model, free of the token overhead associated with prompting. This makes it attractive both for low- and high-volume projects. 

This efficient approach inspires Prompsit’s translation services, offering significant sustainability advantages by using purpose-built NMT engines that require a fraction of the computational power and up to 100 times less energy than general-purpose LLMs. Alongside lean open-source NMT models built from well-curated corpora by OPUS ([github.com/Helsinki-NLP/Opus-MT](https://github.com/Helsinki-NLP/Opus-MT)), Mozilla ([github.com/mozilla/firefox-translations-models](https://github.com/mozilla/firefox-translations-models)) and Prompsit, we provide high-quality Apertium machine translation ([apertium.org](http://apertium.org)) and AltLang variety converters ([altlang.net](http://altlang.net)), offering the stable, predictable behavior of rule-based systems (RBMT) that are even faster and more energy-efficient. Furthermore, we complement these translation engines with automatic evaluation and annotation services to ensure high-quality, cost-effective results.

# **2 Services available**

**Translation**: We offer high-performance NMT and RBMT specializing in low-resource languages and regional variants to ensure contextually accurate output. The API supports text and document translation across a wide range of languages and formats, including robust tag handling and optional quality estimation during processing and leverage from a hierarchy of user’s translation memories. 

**Evaluation**: Our tools measure translation quality using industry-standard automated metrics, allowing users to audit engines by analysing parallel corpora and model performance. This helps maintain professional standards and linguistic consistency across supported language pairs.

**Scoring:** Parallel segments can be scored for translation likelihood using Prompsit’s widely-adopted Bicleaner multilingual models ([github.com/bitextor/bicleaner-ai](https://github.com/bitextor/bicleaner-ai)). These scores are used to identify and filter low-quality translations, to help select higher-quality parallel data for model fine-tuning.

**Annotation**: The API provides sophisticated data processing to deduplicate, label, and score multilingual datasets. Documents are enriched with language identification, personally identifiable information (PII) and adult content flagging, encoding fixes, and quality scores. This metadata enrichment is essential for top document selection in model refinement tasks. 

# **3 The API**

Access to Prompsit’s public translation services API —via GET and POST requests— requires an access token available to registered users. Here’s a curl request to translate a short string:

| curl \-X 'POST' \\ 'https://edge.prompsit.com/v1/translation?enable\_qe=false' \\   \-H 'accept: application/json' \\   \-H 'Authorization: Bearer …auth\_token… \\   \-H 'Content-Type: application/json' \\   \-d '{   "source\_lang": "en",   "target\_lang": "es",   "texts": \[     "Hello world"   \] }' |
| :---- |

To translate a file, one would use a similar call which would return the URLs needed to check status and to download the result file.

Currently customers can directly invoke the API from their internal tools and platforms with simple integration steps. Prompsit plans to offer new CAT connectors to implement the translation services offered in the new API. 

# **4 The command line interface (CLI)**

The command line interface (CLI) provides easier API access for human users but may also be used to easily script complex translation- related tasks. For instance, the command for the translation query inside the CLI above would simply be 

##### translate "Hello world" \-s "en" \-t "es"

From outside the CLI, a script could send

##### prompsit translate "Hello world" \-s "en" \-t "es"

and capture the result for further processing.  

The CLI is available under the Apache 2.0 licence  at [github.com/Prompsit/prompsit-cli](https://github.com/Prompsit/prompsit-cli) for our customers to install locally.

# **5 A bit of technological detail**

Built as a REST application on top of Python 3.13 and FastAPI ([fastapi.tiangolo.com](http://fastapi.tiangolo.com)), our API utilizes a microservice architecture to orchestrate 12 containerized modules that power translation several engines such as Apertium, AltLang, and CTranslate2 ([github.com/opennmt/ctranslate2](https://github.com/opennmt/ctranslate2)). An 8-step pipeline manages tag extraction, 5-level caching, and neural word alignment while a specialized formatting stack (Docling, Okapi, and Tikal) handles over 25 binary and text formats. MetricX-24 ([github.com/google-research/metricx](https://github.com/google-research/metricx)) and COMET ([unbabel.github.io/COMET](https://unbabel.github.io/COMET))  GPU-based estimation are used to ensure quality while Bicleaner-AI and Monotextor ([github.com/bitextor/monotextor](http://github.com/bitextor/monotextor)) provide respectively advanced parallel (sentence pairs) and monolingual corpus (documents) scoring and annotation. Asynchronous job progress is streamed in real-time via server-sent events, all accessible through an open-source npm\-based CLI.

# **6 A summary of features**

**Energy efficiency**: Quantized NMT engines and microservices save GPU and power usage.

**Data privacy**: In-memory processing ensures no data storage or use for model training.

**Latency**: 5-level caching provides millisecond responses and real-time document progress via streaming.

**Language coverage**: A selection of NMT and RBMT engines for major and low-resource languages.

**Format support**: Tag-aware translation for more than 25 different text formats, including Office, PDF, and localization files.

**Transparency**: transparent commands for usage and health monitoring.

# **7 Use via an AI agent**

The CLI repository includes machine-readable *skill* descriptions that enable most popular AI coding assistants to assist the human user to interact with the CLI programmatically to perform translation, evaluation, scoring, annotation, and initial setup. Skills are bundled with the CLI package and deployed automatically on first launch.

This integration is a thin interface layer: the AI assistant interprets user intent and invokes CLI commands. The computational cost of translation services remains unchanged regardless of whether the request originates from a human or an AI assistant. 

| 8 Access and pricing Access is via user and secret key: an API token is generated for each session. Users will enjoy a freemium pricing model for different types of usage: free users may use machine translation indefinitely with monthly translation limits. Paid users, in a number of tiers, have larger limits and may also access evaluation, scoring and annotation services. |  |
| :---- | ----- |

Visit [prompsit.com/en/contact](http://prompsit.com/en/contact) for free API access. A secret key will be sent to your email. Install the CLI with npm install \-g prompsit-cli and authenticate with the provided login.
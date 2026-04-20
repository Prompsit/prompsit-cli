Dear Lev Nikolaevich,

Thank you for your submission to EAMT2026.
The EAMT2026 rebuttal period will be between 17-04-2026 and 22-04-2026

During this time, you will have access to the current state of your reviews and have the opportunity to submit a response of up to 300 words. Please keep in mind the following during this process:

  - The response must focus on any factual errors in the reviews and any questions posed by the reviewers. It must not provide new research results or reformulate the presentation. Try to be as concise and to the point as possible.
  - The reviews are as submitted by the PC members, without any coordination between them. Thus, there may be inconsistencies. Furthermore, these are not the final versions of the reviews. The reviews can later be updated to take into account the discussions at the program committee meeting, and we may find it necessary to solicit other outside reviews after the rebuttal period.
  - The program committee will read your responses carefully and take this information into account during the discussions. On the other hand, the program committee will not directly respond to your responses, either before the program committee meeting or in the final versions of the reviews.
  - Your response will be seen by all PC members who have access to the discussion of your paper, so please try to be polite and constructive.

The reviews on your paper are attached to this letter:

----------------------- REVIEW 1 ---------------------

SUBMISSION: 87
TITLE: Prompsit’s API and CLI: planet-friendly, privacy-first, open-source translation services for everyone

----------- Appropriateness -----------
SCORE: 3 (appropriate)
----- TEXT:
The paper describes an API and CLI for machine translation services built on NMT and RBMT engines with additional features for evaluation, corpus scoring, and dataset annotation.
----------- Clarity -----------
SCORE: 4 (good)
----- TEXT:
I think the paper is well-written and well-structured. It is very clear, although some aspects (mentioned further in the evaluation) should be explained in more detail. I assume it's because the 2-page limit is a bit too strict for this paper.
----------- Substance -----------
SCORE: 4 (good)
----- TEXT:
I think the paper has enough substance but I would recommend that the authors add a couple of items: an evaluation of translation quality across a sample of supported language pairs, a concrete comparison with one or two competing APIs, and meaningful evidence to back up the energy-efficiency claim.
----------- Originality/Innovativeness -----------
SCORE: 3 (fair)
----- TEXT:
The topic does not break new ground with the information provided. It would be valuable to have further information on the "planet-friendly" statement, the languages covered, the "sophisticated data processing to deduplicate, label, and score multilingual datasets, and  quality of the output.
On a positive note, the AI agent integration with its Skill is a forward-looking idea worth noting.
----------- Meaningful comparison -----------
The paper is not referencing any previous work. There are a few statements which seems legitimate but are not backed up by any reference, such as: "classical transformer-based neural machine translation [...] remains the proven backbone for high-volume  professional translation". Besides, no translation quality benchmarks are provided nor energy-efficiency comparison with competitors.
----------- Completeness of the information -----------
All the basic information about the project/product is provided in the paper, although I have personally not tested it. However, the "open-source" claim needs clarification. The CLI is Apache 2.0, but the API backend and the translation engines themselves appear to be proprietary/hosted services. The paper's title says "open-source" but the product is more accurately a freemium service with an open-source client. This could mislead readers.
----------- Impact of Ideas or Result -----------
SCORE: 3 (fair)
----- TEXT:
MT APIs are not new, and the market already includes well-established services, all of which offer similar core functionality. The positioning of the paper around energy efficiency is timely and relevant, given the growing awareness of the environmental cost of LLM-based systems, but it lacks evidence and a comparison with similar products. Again, the AI agent integration with its Skill is a forward-looking idea worth noting.
----------- Ethical concerns -----------
SELECTION: no
----------- Overall evaluation -----------
SCORE: 2 (accept)
----- TEXT:
I think the tool might be very interesting if we can get the information requested above.
----------- Best paper award -----------
SCORE: 0 (no)


----------------------- REVIEW 2 ---------------------

SUBMISSION: 87
TITLE: Prompsit’s API and CLI: planet-friendly, privacy-first, open-source translation services for everyone

----------- Appropriateness -----------
SCORE: 3 (appropriate)
----------- Clarity -----------
SCORE: 4 (good)
----- TEXT:
The paper is generally well-written and clear on the services offered, i.e. focus on environment friendliness, speed, privacy, low resource languages, and user control. However, one thing which is not sufficiently clear is the aspect of fine-tuning models with (curated) parallel data. Does the user have to contact the developers for continued system training/finetuning?

It may be interesting to indicate the importance of low-resource languages in the title (although that may be challenging given the current length of the title).

Some minor remarks:
- well-curated corpora by OPUS -> ... provided by OPUS
- "supports text and document ..." -> "supports snippet and ..." (at least if that is what you mean)
- power translation several engines -> power several translation engines
----------- Substance -----------
SCORE: 4 (good)
----- TEXT:
The services described have many interesting aspects, but some information is lacking:
- trade-off between, on the one hand, energy and speed, and, on the other, translation quality (see also "meaningful comparison" below
- composition of the training corpora in terms of domains
- variety converters: do you mean "language variety converters"?
- analysing parallel corpora and model performance: do you mean "translate held out source sentences from parallel corpora and compare output to target sentences"?
----------- Originality/Innovativeness -----------
SCORE: 4 (good)
----- TEXT:
The individual services are not innovative, but their combination, centered around the idea of environment friendliness, speed, and predictability, carries innovation.
----------- Meaningful comparison -----------
The services proposed are very environment friendly compared to (especially large) LLMs, but some further comparative information is required:
- what is the translation quality of the engines compared to those of broadly used LLM-based systems (e.g. for low resource languages, on openly available benchmarks)? this is important to see the trade-off energy/speed vs. quality
- (if possible) could you give a general idea of the financial cost for large-scale MT by paid users of the freemium model, compared to large-scale MT using LLM-based systems? regarding your mention of "token overhead", do you mean this increases the price for LLM users?
----------- Completeness of the information -----------
The license of the CLI is indicated, as well as the code repository, and an example of a curl request. The main lack of information concerns the pricing model (see "meaningful comparison").
----------- Impact of Ideas or Result -----------
SCORE: 4 (good)
----- TEXT:
The services described are important in the sense that they focus, in a concrete way, on the energy aspect and the aspect of low resource languages. In line with this, they also value the usefulness of MT paradigms preceding LLM-based translation.
----------- Ethical concerns -----------
SELECTION: no
----------- Overall evaluation -----------
SCORE: 2 (accept)
----- TEXT:
The translation services focus on important challenges in the application of MT (energy, speed, privacy, low resource languages), but more comparative information is required, as translation quality and financial cost are also important drivers for end users to select systems.
----------- Best paper award -----------
SCORE: 0 (no)


----------------------- REVIEW 3 ---------------------

SUBMISSION: 87
TITLE: Prompsit’s API and CLI: planet-friendly, privacy-first, open-source translation services for everyone

----------- Appropriateness -----------
SCORE: 3 (appropriate)
----------- Clarity -----------
SCORE: 4 (good)
----------- Substance -----------
SCORE: 3 (fair)
----- TEXT:
The engineering is clearly non-trivial (12 microservices, 8-step pipeline with tag extraction and neural alignment, 5-level caching, 25+ formats, COMET and MetricX for QE). The issue is that the paper stops at description. There are no latency numbers attached to the "millisecond responses" claim, no energy measurements backing the "up to 100 times less energy than general-purpose LLMs" claim, and no throughput figures.
----------- Originality/Innovativeness -----------
SCORE: 3 (fair)
----- TEXT:
The underlying components (OPUS, Apertium, CTranslate2, Bicleaner, COMET, MetricX, Monotextor, Docling, Okapi, Tikal) are all well known, and Prompsit has credible ties to several of them. The contribution is the integration, the opinionated packaging, and the sustainability framing.
----------- Meaningful comparison -----------
The paper positions itself against LLM-based translation in the abstract and section 1, but there is no concrete comparison with any specific commercial NMT provider (DeepL API, Google Cloud Translation, Amazon Translate, ModernMT, Lilt). The "NMT is faster and cheaper than LLMs" position has been discussed in the literature already and a few references would help.
----------- Completeness of the information -----------
Access route for the API is clear. What is missing is the actual pricing for the paid tiers, the free-tier monthly character limit, and any statement about SLA or data-residency options.
----------- Impact of Ideas or Result -----------
SCORE: 3 (fair)
----------- Ethical concerns -----------
SELECTION: no
----------- Overall evaluation -----------
SCORE: 1 (weak accept)
----- TEXT:
This submission describes Prompsit's updated translation API and an accompanying Apache-2.0 CLI, covering translation (NMT plus Apertium RBMT and AltLang variety converters), QE, parallel-corpus scoring via Bicleaner, and monolingual annotation via Monotextor. The technical picture is credible: a FastAPI microservice stack over CTranslate2 engines, with tag-aware handling across 25+ formats, 5-level caching, server-sent events for job progress, and a CLI distributed via npm.
There are a few things I liked. The choice to lean on already-vetted open-source components rather than re-implementing from scratch is the right call for this kind of product. The CLI design with the "prompsit translate ... -s en -t es" style is scriptable and clearly thought out. Bundling QE (COMET, MetricX) and parallel-corpus filtering (Bicleaner-AI) alongside raw translation is pragmatic and matches how MT teams actually work today.
My main hesitations are around evidence. Three claims in particular are load-bearing for the paper's pitch and are not supported:

The "up to 100 times less energy than general-purpose LLMs" figure in section 1 has no reference, no measurement setup, no source model baseline. Given how much of the paper's framing rests on sustainability, at least a pointer to a prior study or an internal measurement note would help.
"Millisecond responses" via 5-level caching is plausible but there are no percentile numbers, no payload sizes, no cache-hit assumptions.
"In-memory processing ensures no data storage or use for model training" is a strong privacy claim that deserves either a brief note on the deployment architecture (for example, whether logs are disabled, how long payloads are retained in worker memory, whether any analytics or telemetry is collected) or a link to a data-processing statement

On balance the paper describes a real, usable, and open service with a genuine open-source component, built on reputable infrastructure, and serving a community that is core to EAMT. If the authors can add a single quantitative paragraph and tighten the AI-agent section, this becomes a clean accept for me.
----------- Best paper award -----------
SCORE: 0 (no)

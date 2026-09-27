/*
 * Fixture di contenuto valide, esportate come `@job-ads-engine/content/testing`
 * per i test degli altri pacchetti. Ricavate dagli esempi della traccia senza
 * RAL nel testo libero e senza informazioni assenti dalla job offer.
 */
import { buildFacts, type ContentTarget, type FactsSource, type Kind } from "../src/index.js";

/** I campi della job offer di esempio (jo_001) da cui nascono i facts. */
export const FACTS_SOURCE: FactsSource = {
  company_name: "AB Group SpA",
  contract_type: "Tempo indeterminato",
  min_exp_years: 3,
  max_exp_years: 5,
  ral_min: 32000,
  ral_max: 38000,
  currency: "EUR",
  required_skills: ["Fotovoltaico industriale", "Cabine secondarie - MT/BT"],
};

export const FACTS = buildFacts(FACTS_SOURCE, "from");

export const JOB_DESCRIPTION = {
  headline: "Assunzione diretta a tempo indeterminato in AB Group SpA",
  company: [
    "AB Group è una multinazionale con oltre 1.700 dipendenti e più di 40 anni di storia in cogenerazione, biogas e rinnovabili.",
    "Entrerai nella divisione che realizza e manutiene grandi impianti fotovoltaici.",
    "Sede centrale a Orzinuovi (Brescia), con trasferte giornaliere e occasionalmente di più giorni.",
  ],
  role: {
    title: "Carriera da capo cantiere fotovoltaico",
    bullets: [
      "Coordina l'installazione elettrica fotovoltaica e segui l'avanzamento lavori insieme al PM.",
      "Esegui collaudi e test funzionali su impianti di grandi dimensioni.",
      "Intervieni sul campo per la manutenzione in caso di guasti.",
    ],
  },
  offer: ["Contratto a tempo indeterminato.", "Ticket da 13 € per ogni giorno lavorato."],
  profile: [
    "3-5 anni di esperienza su installazione e avviamento di impianti FV industriali (> 100 kW).",
    "Esperienza in media tensione.",
    "Disponibilità a trasferte.",
  ],
};

export const CHAT_MESSAGE = {
  opening: "Ciao! AB Group cerca un Tecnico Fotovoltaico a Orzinuovi (BS) ☀️",
  bullets: [
    "Assunzione diretta a tempo indeterminato",
    "Collaudi e manutenzione su impianti FV industriali",
    "3-5 anni di esperienza su impianti oltre 100 kW",
  ],
  cta: "Ti interessa? Rispondi a questo messaggio e ti raccontiamo tutto.",
};

export const JOB_SHEET = {
  title: "Tecnico Fotovoltaico",
  subtitle: "coordinamento cantieri e manutenzione",
  tags: ["Impianti fotovoltaici industriali"],
  description: JOB_DESCRIPTION,
};

export const CAPTION = {
  primary: "Lavori sul fotovoltaico industriale e vuoi crescere in una multinazionale? AB Group cerca tecnici con esperienza su impianti oltre 100 kW.",
  cta: "Scrivici su WhatsApp per candidarti",
  hashtags: ["#lavoro", "#fotovoltaico"],
};

export const CREATIVE = {
  title: { text: "Tecnico Fotovoltaico", highlight: "Fotovoltaico" },
  hook: "ENTRA IN UNA MULTINAZIONALE",
  subline: "Impianti FV >100 kW",
  visual_brief: "Tecnico con casco e giacca ad alta visibilità davanti a un impianto fotovoltaico.",
};

const TEXT_PARTS: Record<Kind, unknown> = {
  job_board: JOB_DESCRIPTION,
  messaging: CHAT_MESSAGE,
  social: CAPTION,
};
const IMAGE_PARTS: Record<Kind, unknown> = {
  job_board: undefined,
  messaging: JOB_SHEET,
  social: CREATIVE,
};

/** Contenuto valido per una combinazione, nel rispetto dei limiti del seed. */
export function validContent({ kind, format }: Pick<ContentTarget, "kind" | "format">) {
  const content: Record<string, unknown> = { facts: FACTS };
  if (format !== "image") {
    // accanto all'immagine il messaggio WhatsApp resta breve
    content.text = kind === "messaging" && format === "image_text"
      ? { ...CHAT_MESSAGE, bullets: CHAT_MESSAGE.bullets.slice(0, 1) }
      : TEXT_PARTS[kind];
  }
  if (format !== "text") content.image = IMAGE_PARTS[kind];
  return content;
}

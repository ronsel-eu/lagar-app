// Italian texts of the importer. Kept apart from messages.ts and prompts.ts, which are generated from the original Lagar (no Italian there).
import type { IssueKey } from './messages'

export const IT_MESSAGES: Record<IssueKey, string> = {
  'The file is too large (2 MB at most).': 'Il file è troppo grande (massimo 2 MB).',
  'The file is empty.': 'Il file è vuoto.',
  'The first row must be the column names. I could not find: {missing}. Download the template and use its columns.': 'La prima riga deve contenere i nomi delle colonne. Non trovo: {missing}. Scarica il modello e usa le sue colonne.',
  'Too many rows (at most {n}).': 'Troppe righe (massimo {n}).',
  'The file has column names but no wines.': 'Il file ha i nomi delle colonne ma nessun vino.',
  "Type '{x}' not recognised; left empty.": 'Tipo «{x}» non riconosciuto; lasciato vuoto.',
  "Date '{x}' not understood (use YYYY-MM-DD); left empty.": 'Data «{x}» non compresa (usa AAAA-MM-GG); lasciata vuota.',
  'The wine needs a name.': 'Il vino ha bisogno di un nome.',
  'The vintage must be a year, or empty / NV.': 'L’annata deve essere un anno, oppure vuota / NV.',
  'Bottles, price paid, format and alcohol must be numbers.': 'Bottiglie, prezzo, formato e alcol devono essere numeri.',
  'Bottles and price paid cannot be negative.': 'Le bottiglie e il prezzo non possono essere negativi.',
  'The vintage is required: write a year, or NV for a non-vintage wine.': 'L’annata è obbligatoria: scrivi un anno, oppure NV per un vino senza annata.',
  'Bottles is empty.': 'Manca il numero di bottiglie.',
  'Same wine and vintage as line {n}; this line is skipped.': 'Stesso vino e stessa annata della riga {n}; questa riga viene saltata.',
}

export const IT_PROMPT =
  'Tengo la mia cantina in un’app chiamata Lagar. Ti darò i miei vini in una forma qualsiasi (un foglio di calcolo, un elenco, appunti, foto di etichette o della mia cantina, esportazioni di un’app di vini o di ordini nei negozi). Trasforma tutto in UN solo file CSV che io possa caricare nell’app.\n\n' +
  'Usa esattamente queste colonne, in quest’ordine, con questa prima riga (i nomi delle colonne restano in inglese, non tradurli):\n' +
  'name,vintage,bottles,type,producer,country,region,appellation,grapes,paid,purchase_date\n\n' +
  'Una riga per vino E annata. Se ho 3 bottiglie dello stesso vino e della stessa annata, è una sola riga con bottles = 3. Lo stesso vino in due annate sono due righe.\n\n' +
  'Regole:\n' +
  '- name: il nome del vino come sull’etichetta, senza il produttore se è un campo a parte e senza l’annata. Esempio: "Viña Tondonia Reserva".\n' +
  '- vintage: un anno di 4 cifre, oppure NV per i vini senza annata.\n' +
  '- bottles: quante bottiglie di questo vino e annata aggiungo alla mia cantina (un numero intero). I vini che ho già bevuto non servono.\n' +
  '- type: uno tra red, white, rosé, sparkling, fortified, sweet, cider (in inglese, esattamente così).\n' +
  '- producer, country, region, appellation: solo se li conosci dal mio materiale o ne sei sicuro. Altrimenti lascia la cella vuota. Il paese va in inglese (Spain, France, Italy...).\n' +
  '- grapes: i vitigni separati da virgole, per esempio "Tempranillo, Garnacha". Vuoto se non si sa.\n' +
  '- paid: prezzo pagato per bottiglia in euro, con punto o virgola per i decimali e senza simbolo di valuta. Vuoto se non si sa.\n' +
  '- purchase_date: AAAA-MM-GG se te lo dico, altrimenti vuoto.\n\n' +
  'Molto importante: NON inventare e NON indovinare mai i dati. Se non conosci un valore, lascia la cella vuota. Metti le virgolette attorno a qualsiasi valore che contenga una virgola. Usa UTF-8 per conservare gli accenti.\n\n' +
  'Quando hai finito, dammi il CSV come file da scaricare (o, se non puoi, in un unico blocco di codice), e poi elenca le righe di cui non eri sicuro, così posso controllarle.'

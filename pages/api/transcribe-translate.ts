import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import { createClient } from '@deepgram/sdk';
import fetch from 'node-fetch';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Readable } from 'stream';
const { Deepgram } = require('@deepgram/sdk');

// Language code to name mapping
const languageMap: { [key: string]: string } = {
  'pl': 'Polish',
  'en-US': 'English (US)',
  'de': 'German',
  'fr': 'French',
  'hr': 'Croatian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'bg': 'Bulgarian',
  'es': 'Spanish',
  'ro': 'Romanian',
  'it': 'Italian',
  'hu': 'Hungarian',
  'cs': 'Czech',
  'sv': 'Swedish',
  // Add other languages as needed
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

  if (!openaiApiKey || !deepgramApiKey) {
    throw new Error('Brak zdefiniowanych kluczy API w zmiennych środowiskowych.');
  }
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const deepgram = new Deepgram({ apiKey: deepgramApiKey });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Błąd parsowania formularza:', err);
      return res.status(500).json({ error: 'Błąd przetwarzania danych formularza' });
    }

    const file = files.audio ? files.audio[0] : undefined;
    const sourceLanguage = fields.sourceLanguage ? fields.sourceLanguage[0] : undefined;
    const targetLanguage = fields.targetLanguage ? fields.targetLanguage[0] : undefined;
    const model = fields.model ? fields.model[0] : 'whisper';  // Dodajemy obsługę modelu

    if (!file || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Brak wymaganych pól' });
    }

    console.log('Informacje o pliku:', {
      name: file.originalFilename,
      type: file.mimetype,
      size: file.size,
      path: file.filepath
    });
    console.log('Język źródłowy:', sourceLanguage);
    console.log('Język docelowy:', targetLanguage);

    try {
      // Transkrypcja z Deepgram
      const audioBuffer = fs.readFileSync(file.filepath);

      console.log('Rozpoczynam transkrypcję Deepgram...');
      const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
      
      // Ustawiamy parametry dla Deepgram
      deepgramUrl.searchParams.append('model', model);  // Używamy wybranego modelu
      deepgramUrl.searchParams.append('language', sourceLanguage);
      deepgramUrl.searchParams.append('punctuate', 'true');
      deepgramUrl.searchParams.append('diarize', 'true');
      deepgramUrl.searchParams.append('utterances', 'true');

      console.log('URL Deepgram:', deepgramUrl.toString());

      const response = await fetch(deepgramUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': file.mimetype || 'application/octet-stream',
        },
        body: audioBuffer,
      });

      console.log('Status odpowiedzi Deepgram:', response.status);
      console.log('Nagłówki odpowiedzi Deepgram:', response.headers);

      const responseText = await response.text();
      console.log('Pełna odpowiedź Deepgram:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText} - ${responseText}`);
      }

      const transcription = JSON.parse(responseText);
      let transcribedText = '';
      let currentParagraph = '';
      let currentSpeaker: number | null = null;

      if (transcription.results && transcription.results.channels && transcription.results.channels[0].alternatives) {
        const alternative = transcription.results.channels[0].alternatives[0];
        
        if (alternative.words) {
          alternative.words.forEach((word: any, index: number) => {
            if (word.speaker !== currentSpeaker) {
              if (currentParagraph) {
                transcribedText += `[Speaker ${currentSpeaker}]: ${currentParagraph.trim()}\n\n`;
                currentParagraph = '';
              }
              currentSpeaker = word.speaker;
            }
            
            currentParagraph += word.punctuated_word + ' ';
            
            // Jeśli to ostatnie słowo lub następny mówca jest inny, dodaj akapit
            if (index === alternative.words.length - 1 || 
                alternative.words[index + 1].speaker !== currentSpeaker) {
              transcribedText += `[Speaker ${currentSpeaker}]: ${currentParagraph.trim()}\n\n`;
              currentParagraph = '';
            }
          });
        } else if (alternative.transcript) {
          transcribedText = alternative.transcript;
        } else {
          transcribedText = 'Nie udało się uzyskać transkrypcji.';
        }
      } else {
        transcribedText = 'Nie udało się przetworzyć odpowiedzi Deepgram.';
      }

      console.log('Transkrybowany tekst:', transcribedText);

      // Tłumaczenie z OpenAI używając modelu GPT-4o-mini
      console.log('Rozpoczynam tłumaczenie OpenAI...');
      const translation = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Jesteś tłumaczem. Przetłumacz następujący tekst z ${sourceLanguage} na ${targetLanguage}. 
            Zachowaj oznaczenia czasu w formacie [MM:SS] na początku każdego zdania.           
            Zachowaj oznaczenia [Agent] i [Klient] na początku każdej wypowiedzi. Agent to sprzedawca, a Klient to kupujący.
            
            Ważna instrukcja dotycząca tłumaczenia:
            - Dla języków francuskim (FR), hiszpańskim (ES), rumuńskim (RO) i włoskim (IT), słowa:
              * "traitement" (FR)1ok
              * "tratamiento" (ES)
              * "trattamento" (IT)
              * "tratament" (RO)
            nie tłumacz jako "leczenie", ale jako "kuracja".
            
            Dodatkowo, w zależności od języka docelowego, użyj następujących słów dla "kuracja":
            - Francuski (FR): "cure"
            - Hiszpański (ES): "tratamiento"
            - Włoski (IT): "trattamento"
            - Rumuński (RO): "tratament"
            
            Dla innych języków użyj odpowiednika słowa "kuracja".`,
          },
          { role: 'user', content: transcribedText },
        ],
      });
      console.log('Tłumaczenie OpenAI zakończone');

      const translatedText = translation.choices[0]?.message?.content || '';
      console.log('Przetłumaczony tekst:', translatedText);
      // Combine short utterances
      const combineShortUtterances = (text: string): string => {
        const lines = text.split('\n');
        let result = '';
        let lastSpeaker = '';
        let lastUtterance = '';

        for (const line of lines) {
          if (line.trim() === '') {
            continue;
          }
          const match = line.match(/\[Speaker (\d+)\]: (.*)/);
          if (match) {
            const [, speaker, utterance] = match;
            if (speaker === lastSpeaker && (lastUtterance.length + utterance.length < 100)) {
              result = result.trim() + ' ' + utterance + '\n';
            } else {
              result += line + '\n';
            }
            lastSpeaker = speaker;
            lastUtterance = utterance;
          } else {
            result += line + '\n';
          }
        }

        return result;
      }

      transcribedText = combineShortUtterances(transcribedText);
      // Identyfikacja mówców za pomocą OpenAI
      const identifySpeakers = async (transcription: string): Promise<string> => {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Jeste ekspertem w analizie transkrypcji rozmów. Twoim zadaniem jest zidentyfikowanie, który mówca jest agentem obsługi klienta, a który klientem. Oznacz każdą wypowiedź odpowiednio [Agent] lub [Klient]."
              },
              {
                role: "user",
                content: `Przeanalizuj poniższą transkrypcję i oznacz każdą wypowiedź jako [Agent] lub [Klient]:\n\n${transcription}`
              }
            ],
            temperature: 0.3,
          });

          return response.choices[0]?.message?.content || '';
        } catch (error) {
          console.error('Błąd podczas identyfikacji mówców:', error);
          return transcription;  // Zwracamy oryginalną transkrypcję w przypadku błędu
        }
      }

      transcribedText = await identifySpeakers(transcribedText);

      console.log('Transkrypcja z oznaczonymi mówcami:', transcribedText);

      // Generowanie pliku DOC z przetłumaczonego tekstu
      const doc = new Document({
        sections: [{
          properties: {},
          children: translatedText.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun(line)]
            })
          )
        }]
      });

      const buffer = await Packer.toBuffer(doc);

      // Wysyłanie odpowiedzi
      res.setHeader('Content-Disposition', 'attachment; filename=transkrypcja.docx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      stream.pipe(res);

      res.status(200).json({ transcription: transcribedText, translation: translatedText });
    } catch (error) {
      console.error('Błąd:', error);
      res.status(500).json({ error: 'Błąd przetwarzania audio: ' + (error as Error).message });
    }
  });
}

async function transcribeAudio(file: File, sourceLanguage: string): Promise<string> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    throw new Error('Brak klucza API Deepgram');
  }

  if (!file.filepath) {
    throw new Error('Brak ścieżki do pliku audio');
  }

  const audioBuffer = fs.readFileSync(file.filepath);

  const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
  deepgramUrl.searchParams.append('model', 'whisper');
  deepgramUrl.searchParams.append('language', sourceLanguage);
  deepgramUrl.searchParams.append('punctuate', 'true');
  deepgramUrl.searchParams.append('diarize', 'true');
  deepgramUrl.searchParams.append('utterances', 'true');

  const response = await fetch(deepgramUrl.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Token ${deepgramApiKey}`,
      'Content-Type': file.mimetype || 'application/octet-stream',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
  }

  const transcription = await response.json();
  
  if (!transcription.results?.channels?.[0]?.alternatives?.[0]?.words) {
    throw new Error('Nie udało się uzyskać transkrypcji z podziałem na słowa');
  }

  const words = transcription.results.channels[0].alternatives[0].words;
  let transcribedText = '';
  let currentSpeaker = '';
  let currentSentence = '';
  let sentenceStartTime = 0;

  words.forEach((word: any, index: number) => {
    if (word.punctuated_word.match(/[.!?]$/)) {
      // Koniec zdania
      currentSentence += word.punctuated_word;
      if (currentSpeaker !== word.speaker || index === 0) {
        const speakerLabel = word.speaker === '0' ? '[Agent]' : '[Klient]';
        transcribedText += `\n[${formatTime(sentenceStartTime)}] ${speakerLabel} ${currentSentence}`;
      } else {
        transcribedText += ` [${formatTime(sentenceStartTime)}] ${currentSentence}`;
      }
      currentSpeaker = word.speaker;
      currentSentence = '';
      sentenceStartTime = word.end;
    } else {
      if (currentSentence === '') {
        sentenceStartTime = word.start;
      }
      currentSentence += word.punctuated_word + ' ';
    }
  });

  // Dodaj ostatnie niedokończone zdanie, jeśli istnieje
  if (currentSentence !== '') {
    const speakerLabel = currentSpeaker === '0' ? '[Agent]' : '[Klient]';
    transcribedText += `\n[${formatTime(sentenceStartTime)}] ${speakerLabel} ${currentSentence.trim()}`;
  }

  console.log('Transkrybowany tekst z czasami rozpoczęcia zdań:', transcribedText);
  return transcribedText.trim();
}

function formatTime(seconds: number): string {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(14, 5); // Zwraca tylko minuty i sekundy (MM:SS)
}
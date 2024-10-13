const formidable = require('formidable-serverless')
const OpenAI = require('openai')
const fs = require('fs')
const { Deepgram } = require('@deepgram/sdk')
const fetch = require('node-fetch')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const deepgram = new Deepgram({ apiKey: process.env.DEEPGRAM_API_KEY })

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  console.log('Received POST request');

  const form = new formidable.IncomingForm()

  return new Promise((resolve, reject) => {
    form.parse(event, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form:', err);
        return resolve({ statusCode: 500, body: JSON.stringify({ error: 'Error parsing form' }) })
      }

      console.log('Form parsed successfully');

      const file = files.file
      if (!file) {
        console.error('No file uploaded');
        return resolve({ statusCode: 400, body: JSON.stringify({ error: 'No file uploaded' }) })
      }

      console.log('File received:', file.name);

      try {
        // Transcribe audio
        console.log('Starting transcription');
        const audioBuffer = fs.readFileSync(file.path)
        const response = await deepgram.transcription.preRecorded(
          { buffer: audioBuffer, mimetype: file.type },
          { punctuate: true, language: 'en-US' }
        );
        const transcript = response.results.channels[0].alternatives[0].transcript;
        console.log('Transcription completed:', transcript);

        // Translate transcript
        console.log('Starting translation');
        const translation = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant that translates English to Polish." },
            { role: "user", content: `Translate the following English text to Polish: "${transcript}"` }
          ],
        })

        const polishTranslation = translation.choices[0].message.content
        console.log('Translation completed:', polishTranslation);

        return resolve({
          statusCode: 200,
          body: JSON.stringify({ transcript, translation: polishTranslation })
        })
      } catch (error) {
        console.error('Error processing audio:', error);
        return resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Error processing audio' })
        })
      }
    })
  })
}

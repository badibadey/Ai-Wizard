const formidable = require('formidable-serverless')
const OpenAI = require('openai')
const fs = require('fs')
const { createClient } = require('@deepgram/sdk')
const fetch = require('node-fetch')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const deepgram = createClient(process.env.DEEPGRAM_API_KEY)

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const form = new formidable.IncomingForm()

  return new Promise((resolve, reject) => {
    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({ statusCode: 500, body: JSON.stringify({ error: 'Error parsing form' }) })
      }

      const file = files.file
      if (!file) {
        return resolve({ statusCode: 400, body: JSON.stringify({ error: 'No file uploaded' }) })
      }

      try {
        // Transcribe audio
        const audioBuffer = fs.readFileSync(file.path)
        const { results } = await deepgram.transcription.preRecorded(
          { buffer: audioBuffer, mimetype: file.type },
          { punctuate: true, language: 'en-US' }
        )
        const transcript = results.channels[0].alternatives[0].transcript

        // Translate transcript
        const translation = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant that translates English to Polish." },
            { role: "user", content: `Translate the following English text to Polish: "${transcript}"` }
          ],
        })

        const polishTranslation = translation.choices[0].message.content

        return resolve({
          statusCode: 200,
          body: JSON.stringify({ transcript, translation: polishTranslation })
        })
      } catch (error) {
        console.error('Error:', error)
        return resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Error processing audio' })
        })
      }
    })
  })
}

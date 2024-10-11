import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const { email, password } = req.body;

  const client = await MongoClient.connect(process.env.MONGODB_URI as string);
  const db = client.db();

  const existingUser = await db.collection('users').findOne({ email });
  if (existingUser) {
    client.close();
    return res.status(400).json({ error: 'Użytkownik już istnieje' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await db.collection('users').insertOne({ email, password: hashedPassword });

  client.close();
  res.status(201).json({ message: 'Użytkownik zarejestrowany', userId: result.insertedId });
}

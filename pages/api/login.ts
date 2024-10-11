import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const { email, password } = req.body;

  const client = await MongoClient.connect(process.env.MONGODB_URI as string);
  const db = client.db();

  const user = await db.collection('users').findOne({ email });
  if (!user) {
    client.close();
    return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    client.close();
    return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

  client.close();
  res.status(200).json({ token });
}

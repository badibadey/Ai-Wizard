'use client'

import { useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "../hooks/use-toast"
import { Upload, FileText, Download, Mic, Loader2, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import React from 'react';
import Image from 'next/image'
import axios from 'axios';



// Symulacja funkcji do zapisywania transkrypcji
const saveTranscription = async (transcription: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return { id: Date.now().toString() }
}

const languages = [
  { value: 'pl', label: 'Polish' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'hr', label: 'Croatian' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sl', label: 'Slovenian' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'es', label: 'Spanish' },
  { value: 'ro', label: 'Romanian' },
  { value: 'it', label: 'Italian' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'cs', label: 'Czech' },
  { value: 'sv', label: 'Swedish' },
];


export default function SelvoyAudioTranscriber() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<string>('pl');
  const [targetLanguage, setTargetLanguage] = useState<string>('en-US');  
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [savedTranscriptionId, setSavedTranscriptionId] = useState<string | null>(null)
  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile && selectedFile.type === 'audio/wav') {
      setFile(selectedFile)
      toast({
        title: "File uploaded successfully",
        description: `${selectedFile.name} is ready for processing.`,
      })
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a WAV file.",
        variant: "destructive",
      })
    }
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'audio/wav': ['.wav'] } })

  const handleTranscribeAndTranslate = async () => {
    if (!file) {
      toast({
        title: "Nie wybrano pliku",
        description: "Proszę najpierw przesłać plik WAV.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('sourceLanguage', sourceLanguage);
    formData.append('targetLanguage', targetLanguage);

    try {
      const response = await fetch('/.netlify/functions/transcribe-translate', {
        method: 'POST',
        body: formData,
      });

      const { transcription, translation } = await response.json();
      const finalResult = `Transkrypcja (${sourceLanguage}):\n${transcription}\n\nTłumaczenie (${targetLanguage}):\n${translation}`;
      
      setResult(finalResult);
      
      const { id } = await saveTranscription(finalResult);
      setSavedTranscriptionId(id);

      toast({
        title: "Przetwarzanie zakończone",
        description: "Twoje audio zostało przetranscypowane, przetłumaczone i zapisane.",
      });
    } catch (error) {
      toast({
        title: "Błąd przetwarzania",
        description: "Wystąpił błąd podczas transkrypcji lub tłumaczenia.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  };

  const handleDownload = () => {
    if (!result) {
      toast({
        title: "No text to download",
        description: "Please transcribe and translate an audio file first.",
        variant: "destructive",
      })
      return
    }

    const blob = new Blob([result], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcription_${savedTranscriptionId}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Download started",
      description: "Your transcription file is being downloaded.",
    })
  }

  return (
    <div className="min-h-screen bg-[#9E0059] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#9E0059] rounded-xl shadow-2xl p-8 space-y-8">
        <motion.div 
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-48 h-16 flex items-center justify-center mb-4">
            <Image
              src="/images/Selvoy-logo.svg"
              alt="Selvoy Logo"
              width={150}
              height={50}
              priority
            />
          </div>
          <div className="w-32 h-32 flex items-center justify-center mb-4 ">
            <Image
              src="/images/wizard-mic.png"
              alt="Wizard microphone"
              width={256}  // Zwiększone do 128px (32 * 4 = 128px)
              height={256} // Zwiększone do 128px (32 * 4 = 128px)
            />
          </div>
          <h1 className="text-4xl font-bold text-white">
            Selvoy AI Wizard
          </h1>
          <p className="text-[#FFD700] mt-2">Transcribe and Translate with AI</p>
        </motion.div>

        <div className="space-y-6">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-300 ${
              isDragActive ? 'border-[#FFD700] bg-[#FFD700] bg-opacity-10' : 'border-white hover:border-[#FFD700]'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-white mb-4" />
            <p className="text-white">Drag & drop your WAV file here, or click to select</p>
            {file && (
              <p className="mt-2 text-sm text-[#FFD700]">
                Selected file: {file.name}
              </p>
            )}
          </div>

          <div className="flex justify-center space-x-4">
            <div className="flex flex-col items-center">
              <label htmlFor="sourceLanguage" className="mb-2 text-sm font-medium text-[#FFD700]">
                Source Language (Audio File)
              </label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger id="sourceLanguage" className="w-[180px] bg-white border-white text-[#9E0059]">
                  <SelectValue placeholder="Source Language" />
                </SelectTrigger>
                <SelectContent 
                  className="bg-white border-white text-[#9E0059] max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#9E0059] scrollbar-track-white"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#9E0059 white',
                  }}
                >
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col items-center">
              <label htmlFor="targetLanguage" className="mb-2 text-sm font-medium text-[#FFD700]">
                Target Language (Translation)
              </label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger id="targetLanguage" className="w-[180px] bg-white border-white text-[#9E0059]">
                  <SelectValue placeholder="Target Language" />
                </SelectTrigger>
                <SelectContent 
                  className="bg-white border-white text-[#9E0059] max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#9E0059] scrollbar-track-white"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#9E0059 white',
                  }}
                >
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center">
            <Button 
              onClick={handleTranscribeAndTranslate} 
              disabled={isLoading || !file}
              className="bg-[#FFD700] hover:bg-[#FFE55C] text-[#9E0059] font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Transcribe & Translate
                </>
              )}
            </Button>
          </div>

          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Progress value={progress} className="w-full bg-white" />
                <p className="text-center text-sm text-[#FFD700]">
                  {progress < 100 ? 'Processing...' : 'Complete!'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <Textarea
            placeholder="Transcribed and translated text will appear here..."
            value={result}
            readOnly
            className="h-48 bg-white border-white text-[#9E0059] placeholder-[#9E0059] focus:border-[#FFD700] focus:ring-[#FFD700]"
          />

          <div className="flex justify-center space-x-4">
            <Button 
              onClick={handleDownload} 
              disabled={!result}
              className="bg-white hover:bg-[#FFD700] text-[#9E0059] font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105 flex items-center"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Text
            </Button>
            {savedTranscriptionId && (
              <Button 
                className="bg-[#FFD700] hover:bg-[#FFE55C] text-[#9E0059] font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105 flex items-center"
              >
                <Save className="mr-2 h-4 w-4" />
                Saved (ID: {savedTranscriptionId})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

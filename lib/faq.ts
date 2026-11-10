export interface FAQItem {
  question: string;
  answer: string;
}

export const GENERAL_FAQS: FAQItem[] = [
  {
    question: 'Are my uploaded files secure and private?',
    answer: 'Yes, completely. Our tools process your images and PDF files client-side directly within your web browser using modern WebAssembly and Canvas APIs. Your files are never uploaded to our servers, stored, or analyzed.',
  },
  {
    question: 'Is this service truly 100% free?',
    answer: 'Yes! There are no hidden fees, subscriptions, credits, watermarks, or account registration requirements. All 25 tools are free to use without restrictions.',
  },
  {
    question: 'What are the file size and batch limits?',
    answer: 'You can process images up to 50 MB each, PDF files up to 100 MB each, and batch process up to 20 files simultaneously.',
  },
  {
    question: 'Do I need to install any software or browser extensions?',
    answer: 'No software installation is required. Everything runs natively inside standard modern web browsers on desktop, tablet, and mobile devices.',
  },
  {
    question: 'Can I use these tools on my mobile phone?',
    answer: 'Yes. The entire platform is built with a responsive mobile-first architecture, allowing you to convert, compress, and organize files on iPhone, iPad, Android, and tablets effortlessly.',
  },
];

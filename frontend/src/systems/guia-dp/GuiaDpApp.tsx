import { useEffect, useMemo, useState } from 'react'
import styles from './App.module.css'
import { Header } from './components/Header'
import { FaqSearch } from './components/FaqSearch'
import { FaqAccordion } from './components/FaqAccordion'
import { AiChat } from './components/AiChat'
import { Footer } from './components/Footer'
import { useAskAi } from './hooks/useAskAi'
import { fetchFaq } from './api'
import { faqMock } from './data/faq.mock'
import type { FaqItem } from './types'

import './styles/global.css'

/** Normaliza texto para a busca local (minúsculas, sem acentos). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function GuiaDpApp() {
  const [faq, setFaq] = useState<FaqItem[]>(faqMock)
  const [loadingFaq, setLoadingFaq] = useState(true)
  const [query, setQuery] = useState('')

  const { messages, loading, error, ask } = useAskAi()

  // Carrega o FAQ da API; cai no mock local em caso de falha.
  useEffect(() => {
    let active = true
    fetchFaq()
      .then((items) => {
        if (active && items.length > 0) setFaq(items)
      })
      .catch(() => {
        // Mantém o faq.mock como fallback silencioso.
      })
      .finally(() => {
        if (active) setLoadingFaq(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Filtra o FAQ pela busca (pergunta + resposta + categoria).
  const filteredFaq = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return faq
    return faq.filter((item) =>
      normalize(`${item.question} ${item.answer} ${item.category ?? ''}`).includes(
        q,
      ),
    )
  }, [faq, query])

  const handleAsk = () => {
    if (!query.trim()) return
    ask(query)
    setQuery('')
  }

  return (
    <div className="guiadp-root">
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Tire suas dúvidas de Departamento Pessoal</h1>
          <p className={styles.lead}>
            Consulte as perguntas mais frequentes sobre rescisão, admissão,
            folha e encargos. Se não encontrar, pergunte ao nosso assistente de
            IA especializado em DP e legislação trabalhista.
          </p>
        </section>

        <FaqSearch
          value={query}
          onChange={setQuery}
          onSubmit={handleAsk}
          resultCount={filteredFaq.length}
        />

        <AiChat messages={messages} loading={loading} error={error} />

        <section>
          <h2 className={styles.sectionTitle}>Perguntas frequentes</h2>
          <FaqAccordion
            items={filteredFaq}
            loading={loadingFaq}
            autoExpand={query.trim().length > 0}
          />
        </section>
      </main>

      <Footer />
    </div>
  )
}

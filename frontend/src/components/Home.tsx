import { useState } from 'react'
import { Users, Plus, LogIn, Shuffle, Search } from 'lucide-react'
import { CHARACTER_CATEGORIES } from '../constants/characters'
import { useI18n, type Lang } from '../i18n'

interface HomeProps {
  onCreateGame: (categoryId: string, hostName: string) => void
  onJoinGame: (code: string, playerName: string) => void
}

const MAX_NAME = 20

export default function Home({ onCreateGame, onJoinGame }: HomeProps) {
  const { t, lang, setLang } = useI18n()
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [hostName, setHostName] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [query, setQuery] = useState('')

  const categories = CHARACTER_CATEGORIES.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  const handleRandomCategory = () => {
    const pool = categories.length > 0 ? categories : CHARACTER_CATEGORIES
    const randomCategory = pool[Math.floor(Math.random() * pool.length)]
    setSelectedCategory(randomCategory.id)
  }

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedCategory && hostName.trim()) {
      onCreateGame(selectedCategory, hostName.trim().slice(0, MAX_NAME))
    }
  }

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault()
    if (gameCode.trim() && playerName.trim()) {
      onJoinGame(
        gameCode.trim().toUpperCase(),
        playerName.trim().slice(0, MAX_NAME)
      )
    }
  }

  const toggleLang = () => {
    const next: Lang = lang === 'es' ? 'en' : 'es'
    setLang(next)
  }

  const langButton = (
    <div className='absolute top-4 right-4'>
      <button
        type='button'
        onClick={toggleLang}
        aria-label={t.home.language}
        title={t.home.language}
        className='text-xs font-semibold text-slate-300 bg-slate-800/70 border border-slate-700 rounded-full px-3 py-1 hover:bg-slate-700 transition-colors'
      >
        {lang === 'es' ? 'ES | EN' : 'EN | ES'}
      </button>
    </div>
  )

  if (mode === 'create') {
    return (
      <div className='relative min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
        {langButton}
        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-2xl border border-slate-700'>
          <button
            onClick={() => setMode('menu')}
            className='text-slate-400 hover:text-white mb-6 transition-colors'
          >
            ← {t.app.backHome}
          </button>

          <div className='text-center mb-8'>
            <div className='w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
              <Plus className='w-8 h-8 text-emerald-400' />
            </div>
            <h2 className='text-3xl font-bold text-white mb-2'>
              {t.home.create}
            </h2>
            <p className='text-slate-400'>{t.home.category}</p>
          </div>

          <form onSubmit={handleCreateGame} className='space-y-6'>
            <div>
              <div className='flex justify-between mb-3'>
                <label
                  htmlFor='category-search'
                  className='text-sm font-medium text-slate-300'
                >
                  {t.home.category}
                </label>
                <button
                  type='button'
                  onClick={handleRandomCategory}
                  className='flex gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors'
                >
                  <Shuffle className='w-3 h-3' />
                  {t.home.random}
                </button>
              </div>
              <div className='relative mb-3'>
                <Search className='w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2' />
                <input
                  id='category-search'
                  type='text'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.home.searchCategories}
                  aria-label={t.home.searchCategories}
                  className='w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm'
                />
              </div>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto'>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type='button'
                    onClick={() => setSelectedCategory(category.id)}
                    aria-pressed={selectedCategory === category.id}
                    className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                      selectedCategory === category.id
                        ? 'bg-emerald-500/20 border-emerald-500'
                        : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className='text-3xl mb-2'>{category.emoji}</div>
                    <div className='text-white text-sm font-medium'>
                      {category.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor='host-name'
                className='block text-sm font-medium text-slate-300 mb-2'
              >
                {t.home.hostName} ({hostName.length}/{MAX_NAME})
              </label>
              <input
                id='host-name'
                type='text'
                value={hostName}
                onChange={(e) => setHostName(e.target.value.slice(0, MAX_NAME))}
                placeholder={t.home.hostNamePlaceholder}
                maxLength={MAX_NAME}
                className='w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
                required
              />
            </div>

            <button
              type='submit'
              disabled={!selectedCategory || !hostName.trim()}
              className='w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-emerald-500/30'
            >
              {t.home.createSubmit}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className='relative min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
        {langButton}
        <div className='bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-700'>
          <button
            onClick={() => setMode('menu')}
            className='text-slate-400 hover:text-white mb-6 transition-colors'
          >
            ← {t.app.backHome}
          </button>

          <div className='text-center mb-8'>
            <div className='w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
              <LogIn className='w-8 h-8 text-blue-400' />
            </div>
            <h2 className='text-3xl font-bold text-white mb-2'>
              {t.home.join}
            </h2>
            <p className='text-slate-400'>{t.home.code}</p>
          </div>

          <form onSubmit={handleJoinGame} className='space-y-6'>
            <div>
              <label
                htmlFor='game-code'
                className='block text-sm font-medium text-slate-300 mb-2'
              >
                {t.home.code}
              </label>
              <input
                id='game-code'
                type='text'
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder={t.home.codePlaceholder}
                maxLength={6}
                className='w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-center text-2xl font-mono tracking-widest'
                required
              />
            </div>

            <div>
              <label
                htmlFor='player-name'
                className='block text-sm font-medium text-slate-300 mb-2'
              >
                {t.home.playerName} ({playerName.length}/{MAX_NAME})
              </label>
              <input
                id='player-name'
                type='text'
                value={playerName}
                onChange={(e) =>
                  setPlayerName(e.target.value.slice(0, MAX_NAME))
                }
                placeholder={t.home.playerNamePlaceholder}
                maxLength={MAX_NAME}
                className='w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                required
              />
            </div>

            <button
              type='submit'
              className='w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-500/30'
            >
              {t.home.joinSubmit}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className='relative min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
      {langButton}
      <div className='text-center'>
        <div className='mb-8'>
          <div className='w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6'>
            <Users className='w-12 h-12 text-red-400' />
          </div>
          <h1 className='text-5xl font-bold text-white mb-3'>
            {t.home.brandTitle}
          </h1>
          <p className='text-xl text-slate-400'>{t.home.brandSubtitle}</p>
        </div>

        <div className='space-y-4 max-w-sm mx-auto'>
          <button
            onClick={() => setMode('create')}
            className='w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 px-6 rounded-xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3'
          >
            <Plus className='w-5 h-5' />
            {t.home.create}
          </button>

          <button
            onClick={() => setMode('join')}
            className='w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3'
          >
            <LogIn className='w-5 h-5' />
            {t.home.join}
          </button>
        </div>
      </div>
    </div>
  )
}

// TODO(Epic 4, Story 4.3): В Epic 4 данные будут подтягиваться из Supabase
// (таблица `onboarding_posts` или поле `is_onboarding: true` в таблице `posts`)
export const ONBOARDING_CONFIG = {
  whatsappUrl:
    process.env.NEXT_PUBLIC_WHATSAPP_URL || 'https://chat.whatsapp.com/placeholder',
  topPosts: [
    {
      id: '1',
      title: 'Как начать создавать UGC-контент',
      category: '#insight',
      type: 'text' as const,
    },
    {
      id: '2',
      title: 'Первый питч бренду: пошаговый шаблон',
      category: '#бренды',
      type: 'text' as const,
    },
    {
      id: '3',
      title: 'Съёмка Reels за 15 минут',
      category: '#reels',
      type: 'video' as const,
    },
    {
      id: '4',
      title: 'Разбор: как работают алгоритмы в 2026',
      category: '#разборы',
      type: 'text' as const,
    },
    {
      id: '5',
      title: 'Домашняя фотостудия с бюджетом €50',
      category: '#съёмка',
      type: 'photo' as const,
    },
  ],
} as const

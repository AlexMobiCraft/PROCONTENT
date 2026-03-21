// TODO(Epic 4, Story 4.3): В Epic 4 данные будут подтягиваться из Supabase
// (таблица `onboarding_posts` или поле `is_onboarding: true` в таблице `posts`)
export const ONBOARDING_CONFIG = {
  whatsappUrl:
    process.env.NEXT_PUBLIC_WHATSAPP_URL || 'https://chat.whatsapp.com/placeholder',
  topPosts: [
    {
      id: '1',
      title: 'Kako začeti ustvarjati UGC vsebino',
      category: '#insight',
      type: 'text' as const,
    },
    {
      id: '2',
      title: 'Prva predstavitev blagovni znamki: vodnik po korakih',
      category: '#blagovne-znamke',
      type: 'text' as const,
    },
    {
      id: '3',
      title: 'Snemanje Reelsov v 15 minutah',
      category: '#reels',
      type: 'video' as const,
    },
    {
      id: '4',
      title: 'Analiza: kako delujejo algoritmi v 2026',
      category: '#analize',
      type: 'text' as const,
    },
    {
      id: '5',
      title: 'Domači foto studio za €50',
      category: '#snemanje',
      type: 'photo' as const,
    },
  ],
} as const

import { Extension } from '@tiptap/core'

export const RELAXED_LINE_HEIGHT = '2.35'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType
      unsetLineHeight: () => ReturnType
    }
  }
}

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight
                ? { style: `line-height: ${attributes.lineHeight}` }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { lineHeight }) ||
          commands.updateAttributes('heading', { lineHeight }),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          commands.resetAttributes('paragraph', 'lineHeight') ||
          commands.resetAttributes('heading', 'lineHeight'),
    }
  },
})

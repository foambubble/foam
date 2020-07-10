import { Foam, Bubble } from '../src/core'
import { createBubbleFromMarkdown } from '../src/utils/utils'

describe('Foam graph', () => {
  it('Adds bubbles to foam', () => {
    const foam = new Foam()
    foam.setBubble(new Bubble('page-a', 'page-a', [], '/page-a.md', ''))
    foam.setBubble(new Bubble('page-b', 'page-b', [], '/page-b.md', ''))
    foam.setBubble(new Bubble('page-c', 'page-c', [], '/page-c.md', ''))

    expect(foam.getBubbles().map(n => n.id).sort()).toEqual(['page-a', 'page-b', 'page-c'])
  })

  it('Detects forward links', () => {
    const foam = new Foam()
    foam.setBubble(new Bubble('page-a', 'page-a', [], '/page-a.md', ''))
    foam.setBubble(new Bubble('page-b', 'page-b', [{to: 'page-a', text: 'go'}], '/page-b.md', ''))
    foam.setBubble(new Bubble('page-c', 'page-c', [], '/page-c.md', ''))

    expect(foam.getForwardLinks('page-b').map(link => link.to).sort()).toEqual(['page-a'])
  })

  it('Detects backlinks', () => {
    const foam = new Foam()
    foam.setBubble(new Bubble('page-a', 'page-a', [], '/page-a.md', ''))
    foam.setBubble(new Bubble('page-b', 'page-b', [{to: 'page-a', text: 'go'}], '/page-b.md', ''))
    foam.setBubble(new Bubble('page-c', 'page-c', [], '/page-c.md', ''))

    expect(foam.getBacklinks('page-a').map(link => link.from).sort()).toEqual(['page-b'])
  })

  it('Fails when accessing non-existing node', () => {
    expect(() => {
      const foam = new Foam()
      foam.setBubble(new Bubble('page-a', 'page-a', [], '/path-b.md', ''))
      foam.getBubble('non-existing')
    }).toThrow()
  })

  it('Updates links when modifying bubble', () => {
    const foam = new Foam()
    foam.setBubble(new Bubble('page-a', 'page-a', [], '/page-a.md', ''))
    foam.setBubble(new Bubble('page-b', 'page-b', [{to: 'page-a', text: 'go'}], '/page-b.md', ''))
    foam.setBubble(new Bubble('page-c', 'page-c', [], '/page-c.md', ''))

    expect(foam.getForwardLinks('page-b').map(link => link.to).sort()).toEqual(['page-a'])
    expect(foam.getBacklinks('page-a').map(link => link.from).sort()).toEqual(['page-b'])
    expect(foam.getBacklinks('page-c').map(link => link.from).sort()).toEqual([])

    foam.setBubble(new Bubble('page-b', 'page-b', [{to: 'page-c', text: 'go'}], '/path-2b.md', ''))

    expect(foam.getForwardLinks('page-b').map(link => link.to).sort()).toEqual(['page-c'])
    expect(foam.getBacklinks('page-a').map(link => link.from).sort()).toEqual([])
    expect(foam.getBacklinks('page-c').map(link => link.from).sort()).toEqual(['page-b'])
  })

})


const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]];
`;

const pageB = `
# Page B

This references [[page-a]]`;

const pageC = `
# Page C
`;

describe('Markdown loader', () => {
  it('Converts markdown to bubbles', () => {
    const foam = new Foam()
    foam.setBubble(createBubbleFromMarkdown('page-a', pageA))
    foam.setBubble(createBubbleFromMarkdown('page-b', pageB))
    foam.setBubble(createBubbleFromMarkdown('page-c', pageC))

    expect(foam.getBubbles().map(n => n.id).sort()).toEqual(['page-a', 'page-b', 'page-c'])
  })

  it('Parses wikilinks correctly', () => {
    const foam = new Foam()
    foam.setBubble(createBubbleFromMarkdown('page-a', pageA))
    foam.setBubble(createBubbleFromMarkdown('page-b', pageB))
    foam.setBubble(createBubbleFromMarkdown('page-c', pageC))

    expect(foam.getBacklinks('page-b').map(link => link.from)).toEqual(['page-a'])
    expect(foam.getForwardLinks('page-a').map(link => link.to)).toEqual(['page-b', 'page-c'])
  })
})

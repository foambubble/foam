import { LooseLinkReference } from '../src/note-graph';

describe('LooseLinkReference', () => {
    it('Will match based on different use of accents', () => {
        const listOfFiles = [
            new LooseLinkReference('zoë')
        ];

        expect(
            LooseLinkReference.findBestMatch(
                listOfFiles, 
                new LooseLinkReference('zoe')
            ).original
        ).toEqual('zoë');
    });

    it('Will match against exactly matches in preference of loose matches', () => {
        const looseMatch = new LooseLinkReference('zoe');
        const exactMatch = new LooseLinkReference('zoë');
        
        const looseFirstList = [
            looseMatch,
            exactMatch
        ];

        const exactFirstList = [
            exactMatch,
            looseMatch
        ];

        expect(
            LooseLinkReference.findBestMatch(
                looseFirstList, 
                new LooseLinkReference('zoë')
            ).original
        ).toEqual('zoë');

        expect(
            LooseLinkReference.findBestMatch(
                exactFirstList, 
                new LooseLinkReference('zoë')
            ).original
        ).toEqual('zoë');
    });
});
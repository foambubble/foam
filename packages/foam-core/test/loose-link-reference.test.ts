import {LooseLinkReference} from '../src/LooseLinkReference'
describe('LooseLinkReference', () => {
    it('Will match based on different use of accents, punctuation and capitalization differences', () => {
        const listOfFiles = [
            new LooseLinkReference('Zoë File')
        ];

        expect(
            LooseLinkReference.findBestMatch(
                listOfFiles, 
                new LooseLinkReference('zoe-file')
            ).original
        ).toEqual('Zoë File');
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
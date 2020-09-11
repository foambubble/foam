import glob from 'glob';
import uriToPath from 'file-uri-to-path';
import { promisify } from 'util';
import { extname, basename, relative } from 'path';

const findAllFiles = promisify(glob);

export async function getWorkspaceFiles(workspaceUri: string) {
    let path = uriToPath(workspaceUri);
    if (path.substr(-1) === '/') {
        path = path.slice(0, -1);
    }
    
    const files = await findAllFiles(`${path}/**/*.md`, {});

    return files.map(filePath => {
        const title = basename(filePath, extname(filePath));
        const fileName = relative(path, filePath);
        const ext = extname(filePath);
        const target = fileName.slice(0, -ext.length);
        return { title, filePath, fileName, target, preview: ''};
    })
}
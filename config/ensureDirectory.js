import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path';


export default function() {
    existsSync(path.join('__dirname', "../DNCAFILES")) || mkdirSync(path.join('__dirname', "../DNCAFILES"));
    existsSync(path.join('__dirname', "../DNCAFILES/pfp")) || mkdirSync(path.join('__dirname', "../DNCAFILES/pfp"));
    existsSync(path.join('__dirname', "../DNCAFILES/grouppfp")) || mkdirSync(path.join('__dirname', "../DNCAFILES/grouppfp"));
    existsSync(path.join('__dirname', "../DNCAFILES/message")) || mkdirSync(path.join('__dirname', "../DNCAFILES/message"));
    existsSync(path.join('__dirname', "../DNCAFILES/message/images")) || mkdirSync(path.join('__dirname', "../DNCAFILES/message/images"));
    existsSync(path.join('__dirname', "../DNCAFILES/message/documents")) || mkdirSync(path.join('__dirname', "../DNCAFILES/message/documents"));
}
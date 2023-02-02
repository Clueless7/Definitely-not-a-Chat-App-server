import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path';


export default function() {
    existsSync(path.join('__dirname', "./files")) || mkdirSync(path.join('__dirname', "./files"));
    existsSync(path.join('__dirname', "./files/pfp")) || mkdirSync(path.join('__dirname', "./files/pfp"));
    existsSync(path.join('__dirname', "./files/grouppfp")) || mkdirSync(path.join('__dirname', "./files/grouppfp"));
    existsSync(path.join('__dirname', "./files/message")) || mkdirSync(path.join('__dirname', "./files/message"));
    existsSync(path.join('__dirname', "./files/message/images")) || mkdirSync(path.join('__dirname', "./files/message/images"));
    existsSync(path.join('__dirname', "./files/message/documents")) || mkdirSync(path.join('__dirname', "./files/message/documents"));
}
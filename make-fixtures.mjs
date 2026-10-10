// Regenera test/fixtures/export-v2.json con la app LEGACY (la anterior a la fase 1). export-v1.json es manual (formato original).
import fs from 'node:fs'; import { boot } from '../harness.mjs';
const a = await boot({}, { dist: 'test/fixtures/legacy-dist.html' }); const sid = a.S.subjects[0].id;
await a.click('addExam'); await a.submit({ title: 'Parcial mates', subjectId: sid, dueDate: '2026-10-21', time: '', learn: 'problemas', goal: 'notable', topics: 'Límites; 4; 3; 0\nDerivadas; 5; 4; 1\nIntegrales', prep: '0', importance: '4', estOverride: '', status: 'pending', notes: '' });
await a.click('addTask'); await a.submit({ title: 'Problemas física', subjectId: a.S.subjects[1].id, dueDate: '2026-10-16', time: '', learn: 'ejercicios', size: '3', difficulty: '3', importance: '3', estOverride: '90', status: 'pending', notes: '' });
const f = a.S.blocks.find(b => b.part === 'main' && b.workId === a.S.works[0].id);
await a.click('doneBlk', f.id); await a.submit({ actualMin: '45', topicId: f.topicId, goalMet: '1', progress: '50', difficulty: '3', interrupted: '0' });
await a.click('addBlk'); await a.submit({ workId: a.S.works[1].id, date: '2026-10-17', s: '12:30', e: '13:20' });
await a.click('export'); fs.writeFileSync('test/fixtures/export-v2.json', a.h.blob); console.log('export-v2.json', a.S.blocks.length, 'bloques');

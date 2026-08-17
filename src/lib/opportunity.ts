import { z } from 'zod';
export const dimensions=['goalAlignment','revenuePotential','personalAdvantage','speedToPrototype','strategicLeverage','marketAccessibility','learningValue','personalInterest'] as const;
export const weights={goalAlignment:.2,revenuePotential:.2,personalAdvantage:.15,speedToPrototype:.15,strategicLeverage:.1,marketAccessibility:.1,learningValue:.05,personalInterest:.05} as const;
export const scoreInput=z.object(Object.fromEntries(dimensions.map(k=>[k,z.number().min(0).max(10)])) as Record<typeof dimensions[number],z.ZodNumber>);
export function opportunityScore(input:z.infer<typeof scoreInput>){const v=scoreInput.parse(input);return Math.round(dimensions.reduce((n,k)=>n+v[k]*weights[k],0)*10)/10}
export function scoreLabel(score:number){if(score<=3)return'Archive';if(score<=5)return'Interesting';if(score<=7)return'Research / Watch';if(score<=8.5)return'Prototype';return'Priority Candidate'}

import { formatUnits } from 'ethers';

import { glyphNumbers, simpleNumbers, crystallMap } from './assets/nft.parts';
import { SVG_ID_LENGTH } from './nft.constants';

export const generateIdSvg = (id: string) => {
  // fill id with zeros to SVG_ID_LENGTH
  const drawable_id = id.padStart(SVG_ID_LENGTH, '0');

  let result = '';
  let space = 0;
  let height = 0;

  for (let i = 0; i < drawable_id.length; i++) {
    result += `<g transform="matrix(1,0,0,1,${space},${height})" opacity="1" style="display: block;">${
      simpleNumbers[drawable_id[i]]
    }</g>`;
    if ((i + 1) % 5 === 0) {
      height += 70;
      space = -30;
    }
    if (drawable_id[i] === '1') space += 25;
    else space += 30;
  }
  return { result, size: space };
};

export const generateDateSvg = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2); // JS months are 0 indexed, 0 = January, 11 = December
  const day = ('0' + date.getDate()).slice(-2);

  const dateString = `${day}.${month}.${year}`;

  let result = '';
  let space = 0;
  let height = 0;
  for (let i = 0; i < dateString.length; i++) {
    result += `<g transform="matrix(1,0,0,1,${space},${height})" opacity="1" style="display: block;">${
      simpleNumbers[dateString[i]]
    }</g>`;
    if (dateString[i] === '.') {
      height += 70;
      space = -30;
    }
    if (dateString[i] === '1' || dateString[i] === ' ') space += 25;
    else space += 30;
  }
  return { result, size: space };
};

export const getCrystallSvgByAmount = (
  amount: string,
): {
  svg: string;
  positions: { x: number; y: number }[];
  claimedColor: string;
} => {
  const amountInEth = parseFloat(formatUnits(amount.toString(), 'ether'));
  const crystallKeys = Object.keys(crystallMap);

  for (let i = 0; i < crystallKeys.length; i++) {
    if (!crystallKeys[i + 1]) return crystallMap[crystallKeys[i]];
    if (amountInEth > Number(crystallKeys[i]) && amountInEth >= Number(crystallKeys[i + 1])) continue;
    if (amountInEth >= Number(crystallKeys[i])) return crystallMap[crystallKeys[i]];
  }

  return crystallMap[crystallKeys[0]];
};

export const generateCrystallSvg = (
  scrystall: string,
  animatonPath: string,
  position: { x: number; y: number },
  color: string,
  a = 1,
  d = 1,
) => {
  return `
    <g transform="matrix(${a},0,0,${d},${position.x},${position.y})" opacity="1" style="display: block;" fill="${color}">
      <animateMotion
        dur="8s"
        repeatCount="indefinite"
        path="${animatonPath}"/>
      ${scrystall}
    </g>
    `;
};

// function for generate amount on svg by glyphNumbers
export const generateAmountSvg = (amount: string) => {
  let result = '';
  let space = 0;
  for (let i = 0; i < amount.length; i++) {
    result += `<g transform="matrix(1,0,0,1,${space},0)" opacity="1" style="display: block;">${
      glyphNumbers[amount[i]]
    }</g>`;
    if (amount[i] === '1' || amount[i] === '.' || amount[i] === ' ' || amount[i] === '(' || amount[i + 1] === '(')
      space += 100;
    else space += 200;
  }
  return { result, size: space };
};

export const generateAmountLineSvg = (amount: string, x: number) => {
  const { result, size } = generateAmountSvg(amount);
  const line = `
      <g transform="matrix(0,-1,1,0,${x},0)" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      <g transform="matrix(0,-1,1,0,${x},${size + 200})" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      <g transform="matrix(0,-1,1,0,${x},${size * 2 + 200 * 2})" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      <g transform="matrix(0,-1,1,0,${x},${-size - 200})" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      `;

  return { line, size };
};

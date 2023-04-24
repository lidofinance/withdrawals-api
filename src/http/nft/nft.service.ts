import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { formatUnits } from 'ethers';
import { ConfigService } from 'common/config';
import { QueueInfoStorageService } from 'storage';

import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';
import { glyphNumbers, simpleNumbers, phrase, bgTwo, bgOne, lidoGray, ethColor, crystallMap } from './assets/nft.parts';

const ALLOWED_ID_LIST = [74, 415, 82, 92, 93, 489, 415, 414, 413, 210];

@Injectable()
export class NFTService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly queueInfo: QueueInfoStorageService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getNftMeta(params: NFTParamsDto, query: NFTOptionsDto): Promise<NFTDto | null> {
    const name = this.queueInfo.getTokenName();
    const symbol = this.queueInfo.getTokenSymbol();

    const image = ALLOWED_ID_LIST.includes(Number(params.tokenId))
      ? `data:image/svg+xml;base64,${Buffer.from(this.generateSvgImage(params, query)).toString('base64')}`
      : null;

    const meta = {
      name: name,
      description: symbol,
      image,
    };
    return meta;
  }

  async getNftImage(params: NFTParamsDto, query): Promise<string> {
    return this.generateSvgImage(params, query);
  }

  convertFromWei(amountInWei: string, prefix?: string): string {
    const amountInGwei = parseFloat(formatUnits(amountInWei.toString(), 'gwei'));
    const amountInEth = parseFloat(formatUnits(amountInWei.toString(), 'ether'));

    if (amountInEth >= 0.00009) {
      return `${parseFloat(amountInEth.toFixed(6))} ${prefix ? prefix : ''}ETH`;
    } else if (amountInGwei >= 1) {
      return `${parseFloat(amountInGwei.toFixed(2))} GWEI${prefix ? '(STETH)' : ''}`;
    } else {
      return `${amountInWei} WEI${prefix ? '(STETH)' : ''}`;
    }
  }

  // function for generate amount on svg by glyphNumbers
  private generateAmountSvg(amount: string) {
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
  }

  // function for generate id on svg by simpleNumber
  private generateIdSvg(id: string) {
    let result = '';
    let space = 0;
    for (let i = 0; i < id.length; i++) {
      result += `<g transform="matrix(1,0,0,1,${space},0)" opacity="1" style="display: block;">${
        simpleNumbers[id[i]]
      }</g>`;
      if (id[i] === '1') space += 15;
      else space += 30;
    }
    return { result, size: space };
  }

  // function for generate id on svg by simpleNumber
  private generateDateSvg(timestamp: number) {
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
      if (dateString[i] === '1' || dateString[i] === ' ') space += 15;
      else space += 30;
    }
    return { result, size: space };
  }

  private generateAmountLineSvg(amount: string, x: number) {
    const { result, size } = this.generateAmountSvg(amount);
    let line = '';

    line += `
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
  }

  private generateCrystallSvg(
    scrystall: string,
    animatonPath: string,
    position: { x: number; y: number },
    color: string,
    a = 1,
    d = 1,
  ) {
    return `
    <g transform="matrix(${a},0,0,${d},${position.x},${position.y})" opacity="1" style="display: block;" fill="${color}">
      <animateMotion
        dur="7s"
        repeatCount="indefinite"
        path="${animatonPath}"/>
      ${scrystall}
    </g>
    `;
  }

  private getCrystallSvgByAmount(amount: string): {
    svg: string;
    positions: { x: number; y: number }[];
    claimedColor: string;
  } {
    const amountInEth = parseFloat(formatUnits(amount.toString(), 'ether'));
    const crystallKeys = Object.keys(crystallMap);

    for (let i = 0; i < crystallKeys.length; i++) {
      if (!crystallKeys[i + 1]) return crystallMap[crystallKeys[i]];
      if (amountInEth > Number(crystallKeys[i]) && amountInEth > Number(crystallKeys[i + 1])) continue;
      if (amountInEth >= Number(crystallKeys[i])) return crystallMap[crystallKeys[i]];
    }

    return crystallMap[crystallKeys[0]];
  }

  generateSvgImage(params: NFTParamsDto, query: NFTOptionsDto): string {
    // TODO: implement svg generation
    const { requested, created_at, finalized } = query;
    const tokenId = Number(params.tokenId);
    const isPending = !finalized;
    const prefix = isPending ? 'ST' : '';
    const amount = isPending ? requested : finalized;

    const crystall = this.getCrystallSvgByAmount(amount);
    const convertedAmount = this.convertFromWei(amount, prefix);

    const token = isPending ? lidoGray : ethColor;
    const bg = isPending ? bgTwo : bgOne;
    const textColor = isPending ? '#8393AC' : crystall.claimedColor;

    const left = this.generateAmountLineSvg(convertedAmount, 0);
    const right = this.generateAmountLineSvg(convertedAmount, 1880);
    const id = this.generateIdSvg(tokenId.toString());
    const date = this.generateDateSvg(created_at);

    const lineAnimationDuration = 22;

    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"
  preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);">
      <defs>
        <clipPath id="content"><rect width="2000" height="2000" x="0" y="0"></rect></clipPath>
      </defs>
      <g clip-path="url(#content)">
        ${bg}
        ${token}
        <g clip-path="url(#__lottie_element_172)" opacity="1" style="display: block;" fill="${textColor}">
          <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 ${
            left.size * 2 + 200 * 2
          }"
          to="0 0" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"/>
          ${left.line}
        </g>
        <g clip-path="url(#__lottie_element_172)" opacity="1" style="display: block;" fill="${textColor}">
          <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 0" to="0 ${
            right.size * 2 + 200 * 2
          }" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"/>
            ${right.line}
        </g>
        <g transform="matrix(1,0,0,1,1025,1500)" opacity="1" style="display: block;" fill="${textColor}">
          ${phrase}
        </g>
        ${this.generateCrystallSvg(crystall.svg, 'M 150 -300 50 -50 z', crystall.positions[0], textColor)}
        ${this.generateCrystallSvg(crystall.svg, 'M 200 -200 0 -0 z', crystall.positions[1], textColor)}
        ${this.generateCrystallSvg(crystall.svg, 'M 0 0 -150 -200 z', crystall.positions[2], textColor, -1, -1)}
        ${this.generateCrystallSvg(crystall.svg, 'M 0 0 150 -350 z', crystall.positions[3], textColor, -1)}
        <g transform="matrix(1,0,0,1,301,899)" opacity="1" style="display: block;" fill="${textColor}">${id.result}</g>
        <g transform="matrix(1,0,0,1,1194,96)" opacity="1" style="display: block;" fill="${textColor}">${
      date.result
    }</g>
      </g>
    </svg>
    `;

    return svgString;
  }
}

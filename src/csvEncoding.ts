export const csvEncodings = ['auto', 'utf-8', 'gb18030', 'big5', 'utf-16le', 'utf-16be'] as const;

export type CsvEncoding = typeof csvEncodings[number];

export type DecodedCsv = {
  text: string;
  encoding: Exclude<CsvEncoding, 'auto'>;
};

const commonChineseCharacters = new Set(
  '的一是不了在人有我他这中大来上个国到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东政海口使教西再平真听世气信北少关并内加化由却代军产入先山五太水万市眼体别处总才场师书比住员九笑性通目华报立马命原城题活尔更党直提放通西爱表系安线美合还建特级展品果料象员革位加面机各样数权体制些表着路期统响术流增关青整改示根完必战才争精万取神认且及队今维片讲争界门利海受集式确传该并制反者形识指联队装程强议更空决治展马科司五基眼书非则听白却界达光放强即像难且权思王象完设式色路记南品住告类求据程北边死张该交规万取拉格望觉术领共确传师观清今切院让识候带导争运笑飞风步改收根干造言联持组每济车亲极林服快办议往元英证近失转夫令准布始怎呢存未远叫台单影具罗字爱击流备兵连调深商算质团集百需价花党华城石级整府离况亚请技际约示复病息究线似官火断精满支视消越器容照须九增研写称企八功吗包片史委乎查轻易早曾除农找装广显吧阿李标谈吃图念六引历首医局突专费号尽另周较注语仅考落随选列武红响虽推势参希古众构房半节土投某案黑维革划敌致陈律足态护七兴派孩验责营星够章音跟志底站严巴例防族供效续施留讲型料终答紧黄绝奇察母京段依批群项故按河米围江织害斗双境客纪采举杀攻父苏密低朝友诉止细愿千值仍男钱破网热助倒育属坐帝限船脸职速刻乐否刚威毛状率甚独球般普怕弹校苦创假久错承印晚兰试股拿脑预谁益阳若哪微尼继送急血惊伤素药适波夜省初喜卫源食险待述陆习置居劳财环排福纳欢雷警获模充负云停木游龙树疑层冷洲冲射略范竟句室异激汉村哈策演简卡罪判担州静退既衣您宗积余痛检差富灵协角占配征修皮挥胜降阶审沉坚善妈刘读啊超免压银买皇养伊怀执副乱抗犯追帮宣佛岁航优怪香著田铁控税左右份穿艺背阵草脚概恶块顿敢守酒岛托央户烈洋哥索胡款靠评版宝座释景顾弟登货互付伯慢欧换闻危忙核暗姐介坏讨丽良序升监临亮露永呼味野架域沙掉括舰鱼杂误湾吉减编楚肯测败屋跑梦散温困剑渐封救贵枪缺楼县尚毫移娘朋画班智亦耳恩短掌恐遗固席松秘谢鲁遇康虑幸均销钟诗藏赶剧票损忽巨炮旧端探湖录叶春乡附吸予礼港雨呀板庭妇归睛饭额含顺输摇招婚脱补谓督毒油疗旅泽材灭逐莫笔亡鲜词圣择寻厂睡博忽勒烟授诺伦岸奥唐卖俄炸载洛健堂旁宫喝借君禁阴园谋宋避抓荣姑孙逃牙束跳顶玉镇雪午练迫爷篇肉嘴馆遍凡础洞卷坦牛宁纸诸训私庄祖丝翻暴森塔默握戏隐熟骨访弱蒙歌店鬼软典欲萨伙遭盘爸扩盖弄雄稳忘亿刺拥徒姆顺虑启综趋杜奶奏练智抢遗胆紧词票兰套献予晨趣绿乘射袜织拜允怜闹扩码尝奋深守顿互追惊帮餐益标严楼断审注估塞静例设密宣章验欧富察神途移铜威辛帮遗锛',
);

export function decodeCsv(bytes: Uint8Array, requested: CsvEncoding = 'auto'): DecodedCsv {
  if (requested !== 'auto') {
    return { text: decode(bytes, requested), encoding: requested };
  }

  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) return { text: decode(bytes, 'utf-8'), encoding: 'utf-8' };
  if (startsWith(bytes, [0xff, 0xfe])) return { text: decode(bytes, 'utf-16le'), encoding: 'utf-16le' };
  if (startsWith(bytes, [0xfe, 0xff])) return { text: decode(bytes, 'utf-16be'), encoding: 'utf-16be' };

  const utf16 = detectBomlessUtf16(bytes);
  if (utf16) return { text: decode(bytes, utf16), encoding: utf16 };

  const utf8 = tryDecode(bytes, 'utf-8');
  if (utf8 !== undefined) return { text: utf8, encoding: 'utf-8' };

  const legacyCandidates = (['gb18030', 'big5'] as const)
    .map((encoding) => ({ encoding, text: tryDecode(bytes, encoding) }))
    .filter((candidate): candidate is { encoding: 'gb18030' | 'big5'; text: string } => candidate.text !== undefined)
    .sort((left, right) => scoreChineseText(right.text) - scoreChineseText(left.text));

  const best = legacyCandidates[0];
  if (best) return best;
  return { text: decode(bytes, 'utf-8'), encoding: 'utf-8' };
}

function decode(bytes: Uint8Array, encoding: Exclude<CsvEncoding, 'auto'>): string {
  return new TextDecoder(encoding).decode(bytes);
}

function tryDecode(bytes: Uint8Array, encoding: Exclude<CsvEncoding, 'auto'>): string | undefined {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function detectBomlessUtf16(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | undefined {
  const sampleLength = Math.min(bytes.length - (bytes.length % 2), 4096);
  if (sampleLength < 8) return undefined;
  let evenNulls = 0;
  let oddNulls = 0;
  for (let index = 0; index < sampleLength; index += 2) {
    if (bytes[index] === 0) evenNulls += 1;
    if (bytes[index + 1] === 0) oddNulls += 1;
  }
  const pairs = sampleLength / 2;
  if (oddNulls / pairs > 0.3 && evenNulls / pairs < 0.1) return 'utf-16le';
  if (evenNulls / pairs > 0.3 && oddNulls / pairs < 0.1) return 'utf-16be';
  return undefined;
}

function scoreChineseText(text: string): number {
  let score = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (commonChineseCharacters.has(character)) score += 4;
    else if (codePoint >= 0x4e00 && codePoint <= 0x9fff) score += 1;
    else if (codePoint >= 0x3400 && codePoint <= 0x4dbf) score -= 2;
    else if (codePoint < 0x20 && character !== '\n' && character !== '\r' && character !== '\t') score -= 8;
  }
  return score;
}

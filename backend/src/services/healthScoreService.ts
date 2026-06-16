import { prisma } from '../index.js';
import type { AssetRecord, HealthConfig, InventoryPlan } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library.js';

export interface DimensionScore {
  score: number;
  weight: number;
  suggestion: string;
}

export interface HealthScoreResult {
  totalScore: number;
  emergencyReserve: DimensionScore;
  assetAllocation: DimensionScore;
  growthStability: DimensionScore;
  inventoryTimeliness: DimensionScore;
  dataQuality: 'FULL' | 'PARTIAL' | 'LIMITED' | 'INSUFFICIENT';
  dataQualityNote?: string;
  calculatedAt: Date;
}

interface CalculationInput {
  userId: string;
  config?: HealthConfig;
  assetRecords?: AssetRecord[];
  inventoryPlan?: InventoryPlan | null;
}

const DEFAULT_CONFIG = {
  monthlyExpense: 5000,
  targetCashRatio: 0.3,
  targetLongTermInvestRatio: 0.5,
  targetStableBondRatio: 0.2,
  emergencyReserveWeight: 0.3,
  assetAllocationWeight: 0.3,
  growthStabilityWeight: 0.25,
  inventoryTimelinessWeight: 0.15,
  volatilityWindowMonths: 6,
  minEmergencyReserveMonths: 3,
  idealEmergencyReserveMonths: 6,
};

export function normalizeWeights(config: {
  emergencyReserveWeight: number;
  assetAllocationWeight: number;
  growthStabilityWeight: number;
  inventoryTimelinessWeight: number;
}) {
  const total =
    config.emergencyReserveWeight +
    config.assetAllocationWeight +
    config.growthStabilityWeight +
    config.inventoryTimelinessWeight;

  if (Math.abs(total - 1) < 0.001) {
    return config;
  }

  return {
    emergencyReserveWeight: config.emergencyReserveWeight / total,
    assetAllocationWeight: config.assetAllocationWeight / total,
    growthStabilityWeight: config.growthStabilityWeight / total,
    inventoryTimelinessWeight: config.inventoryTimelinessWeight / total,
  };
}

export function calculateEmergencyReserveScore(
  cash: number,
  monthlyExpense: number,
  minMonths: number,
  idealMonths: number
): DimensionScore {
  const weight = DEFAULT_CONFIG.emergencyReserveWeight;

  if (monthlyExpense <= 0) {
    return {
      score: 0,
      weight,
      suggestion: '请配置有效的月支出金额以计算应急储备充足度',
    };
  }

  const reserveMonths = cash / monthlyExpense;

  let score = 0;
  let suggestion = '';

  if (reserveMonths <= 0) {
    score = 0;
    suggestion = `您目前没有应急储备金，建议至少储备${minMonths}个月的支出（¥${(monthlyExpense * minMonths).toFixed(2)}）作为安全垫。`;
  } else if (reserveMonths < minMonths) {
    score = Math.round((reserveMonths / minMonths) * 60);
    const deficit = monthlyExpense * minMonths - cash;
    suggestion = `应急储备仅能覆盖${reserveMonths.toFixed(1)}个月支出，建议补充¥${deficit.toFixed(2)}以达到${minMonths}个月的最低安全线。`;
  } else if (reserveMonths < idealMonths) {
    const progress = (reserveMonths - minMonths) / (idealMonths - minMonths);
    score = 60 + Math.round(progress * 35);
    const remaining = monthlyExpense * idealMonths - cash;
    suggestion = `应急储备可覆盖${reserveMonths.toFixed(1)}个月支出，再储备¥${remaining.toFixed(2)}即可达到${idealMonths}个月的理想水平。`;
  } else if (reserveMonths < idealMonths * 2) {
    score = 95 + Math.round(((reserveMonths - idealMonths) / idealMonths) * 5);
    suggestion = `应急储备充足（${reserveMonths.toFixed(1)}个月），财务抗风险能力良好。`;
  } else {
    score = 100;
    suggestion = `应急储备非常充足（${reserveMonths.toFixed(1)}个月），可考虑将部分资金用于投资以提高收益。`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    suggestion,
  };
}

export function calculateAssetAllocationScore(
  cash: number,
  longTermInvest: number,
  stableBond: number,
  targetCashRatio: number,
  targetLongTermRatio: number,
  targetStableBondRatio: number
): DimensionScore {
  const weight = DEFAULT_CONFIG.assetAllocationWeight;
  const total = cash + longTermInvest + stableBond;

  if (total <= 0) {
    return {
      score: 0,
      weight,
      suggestion: '暂无资产数据，请先记录资产情况以评估配置合理性。',
    };
  }

  const actualCashRatio = cash / total;
  const actualLongTermRatio = longTermInvest / total;
  const actualStableBondRatio = stableBond / total;

  const deviation =
    Math.abs(actualCashRatio - targetCashRatio) +
    Math.abs(actualLongTermRatio - targetLongTermRatio) +
    Math.abs(actualStableBondRatio - targetStableBondRatio);

  const maxDeviation = 2;
  const normalizedDeviation = Math.min(deviation / maxDeviation, 1);
  const score = Math.round((1 - normalizedDeviation) * 100);

  let suggestion = '';
  const deviations = [];

  if (Math.abs(actualCashRatio - targetCashRatio) > 0.05) {
    const diff = actualCashRatio - targetCashRatio;
    const amountDiff = total * diff;
    if (diff > 0) {
      deviations.push(`现金占比偏高${(diff * 100).toFixed(1)}个百分点（¥${amountDiff.toFixed(2)}），可考虑转出部分至投资`);
    } else {
      deviations.push(`现金占比偏低${(Math.abs(diff) * 100).toFixed(1)}个百分点，建议补充¥${Math.abs(amountDiff).toFixed(2)}`);
    }
  }

  if (Math.abs(actualLongTermRatio - targetLongTermRatio) > 0.05) {
    const diff = actualLongTermRatio - targetLongTermRatio;
    const amountDiff = total * diff;
    if (diff > 0) {
      deviations.push(`长期投资占比偏高${(diff * 100).toFixed(1)}个百分点（¥${amountDiff.toFixed(2)}）`);
    } else {
      deviations.push(`长期投资占比偏低${(Math.abs(diff) * 100).toFixed(1)}个百分点，建议增加¥${Math.abs(amountDiff).toFixed(2)}`);
    }
  }

  if (Math.abs(actualStableBondRatio - targetStableBondRatio) > 0.05) {
    const diff = actualStableBondRatio - targetStableBondRatio;
    const amountDiff = total * diff;
    if (diff > 0) {
      deviations.push(`稳健债券占比偏高${(diff * 100).toFixed(1)}个百分点（¥${amountDiff.toFixed(2)}）`);
    } else {
      deviations.push(`稳健债券占比偏低${(Math.abs(diff) * 100).toFixed(1)}个百分点，建议增加¥${Math.abs(amountDiff).toFixed(2)}`);
    }
  }

  if (deviations.length === 0) {
    suggestion = '资产配置与目标高度契合，保持当前配置即可。';
  } else {
    suggestion = '配置优化建议：' + deviations.join('；') + '。';
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    suggestion,
  };
}

export function calculateGrowthStabilityScore(
  records: AssetRecord[],
  windowMonths: number
): DimensionScore {
  const weight = DEFAULT_CONFIG.growthStabilityWeight;

  if (records.length < 3) {
    return {
      score: 50,
      weight,
      suggestion: `需要至少3条历史记录来评估增长稳定性，当前仅有${records.length}条，请持续记录。`,
    };
  }

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const recentRecords = sortedRecords.slice(-Math.min(windowMonths + 1, sortedRecords.length));

  if (recentRecords.length < 3) {
    return {
      score: 50,
      weight,
      suggestion: `近${windowMonths}个月的数据不足，需要更多记录来准确评估稳定性。`,
    };
  }

  const returns: number[] = [];
  for (let i = 1; i < recentRecords.length; i++) {
    const prevTotal = Number(recentRecords[i - 1].total);
    const currTotal = Number(recentRecords[i].total);
    if (prevTotal > 0) {
      returns.push((currTotal - prevTotal) / prevTotal);
    }
  }

  if (returns.length < 2) {
    return {
      score: 50,
      weight,
      suggestion: '有效收益数据不足，无法准确评估增长稳定性。',
    };
  }

  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const annualizedVolatility = stdDev * Math.sqrt(12);

  let score = 0;
  let suggestion = '';

  if (annualizedVolatility <= 0.02) {
    score = 100;
    suggestion = `增长非常稳定（年化波动率${(annualizedVolatility * 100).toFixed(2)}%），资产曲线平滑。`;
  } else if (annualizedVolatility <= 0.05) {
    score = 90 + Math.round((0.05 - annualizedVolatility) / 0.03 * 10);
    suggestion = `增长稳定（年化波动率${(annualizedVolatility * 100).toFixed(2)}%），波动在可控范围内。`;
  } else if (annualizedVolatility <= 0.1) {
    score = 70 + Math.round((0.1 - annualizedVolatility) / 0.05 * 20);
    suggestion = `波动适中（年化波动率${(annualizedVolatility * 100).toFixed(2)}%），建议关注高波动资产的占比。`;
  } else if (annualizedVolatility <= 0.2) {
    score = 40 + Math.round((0.2 - annualizedVolatility) / 0.1 * 30);
    suggestion = `波动较大（年化波动率${(annualizedVolatility * 100).toFixed(2)}%），建议增加稳健资产以分散风险。`;
  } else {
    score = Math.max(0, Math.round(40 - (annualizedVolatility - 0.2) * 100));
    suggestion = `波动剧烈（年化波动率${(annualizedVolatility * 100).toFixed(2)}%），建议重新评估风险承受能力，降低高风险资产占比。`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    suggestion,
  };
}

export function calculateInventoryTimelinessScore(
  inventoryPlan: InventoryPlan | null,
  lastInventoryDate: Date | null,
  latestRecordDate: Date | null
): DimensionScore {
  const weight = DEFAULT_CONFIG.inventoryTimelinessWeight;
  const now = new Date();

  const effectiveLastDate = lastInventoryDate || latestRecordDate;

  if (!effectiveLastDate) {
    return {
      score: 40,
      weight,
      suggestion: '尚未开始资产盘点，请尽快建立定期盘点习惯。',
    };
  }

  let expectedIntervalDays = 30;
  if (inventoryPlan) {
    switch (inventoryPlan.cycleType) {
      case 'WEEKLY':
        expectedIntervalDays = 7;
        break;
      case 'MONTHLY':
        expectedIntervalDays = 30;
        break;
      case 'CUSTOM':
        expectedIntervalDays = inventoryPlan.customIntervalDays || 30;
        break;
    }
  }

  const daysSinceLastInventory = Math.floor(
    (now.getTime() - new Date(effectiveLastDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  let score = 0;
  let suggestion = '';

  if (daysSinceLastInventory <= expectedIntervalDays) {
    score = 100;
    suggestion = `盘点及时，上次盘点距今${daysSinceLastInventory}天，保持良好习惯！`;
  } else if (daysSinceLastInventory <= expectedIntervalDays * 1.5) {
    score = 80 + Math.round(
      ((expectedIntervalDays * 1.5 - daysSinceLastInventory) / (expectedIntervalDays * 0.5)) * 20
    );
    suggestion = `上次盘点距今${daysSinceLastInventory}天，已超过计划周期${expectedIntervalDays}天，建议尽快盘点。`;
  } else if (daysSinceLastInventory <= expectedIntervalDays * 2) {
    score = 50 + Math.round(
      ((expectedIntervalDays * 2 - daysSinceLastInventory) / (expectedIntervalDays * 0.5)) * 30
    );
    suggestion = `上次盘点距今${daysSinceLastInventory}天，已严重滞后，建议立即盘点并调整盘点计划。`;
  } else {
    score = Math.max(0, 50 - Math.round((daysSinceLastInventory - expectedIntervalDays * 2) / expectedIntervalDays * 10));
    suggestion = `已${daysSinceLastInventory}天未盘点，数据时效性严重不足，请尽快更新资产数据。`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    suggestion,
  };
}

export function assessDataQuality(
  records: AssetRecord[],
  config: HealthConfig | undefined,
  hasInventoryPlan: boolean
): { quality: HealthScoreResult['dataQuality']; note: string } {
  const issues: string[] = [];

  if (!config) {
    issues.push('未配置健康度评分参数，使用默认配置');
  }

  if (records.length === 0) {
    return {
      quality: 'INSUFFICIENT',
      note: '暂无资产记录，请先添加至少一条资产记录。',
    };
  }

  if (records.length < 3) {
    issues.push(`仅${records.length}条记录，数据量不足影响稳定性评估准确性`);
  }

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const daysSpan =
    (new Date(sortedRecords[sortedRecords.length - 1].date).getTime() -
      new Date(sortedRecords[0].date).getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysSpan < 30) {
    issues.push('记录时间跨度不足1个月，长期趋势评估可能不准确');
  }

  if (!hasInventoryPlan) {
    issues.push('未设置盘点计划，及时性评估使用默认30天周期');
  }

  if (issues.length === 0) {
    return { quality: 'FULL', note: '数据充足，评分结果可靠' };
  } else if (issues.length <= 1) {
    return { quality: 'PARTIAL', note: issues.join('；') };
  } else {
    return { quality: 'LIMITED', note: issues.join('；') };
  }
}

export async function calculateHealthScore(
  input: CalculationInput
): Promise<HealthScoreResult> {
  const { userId } = input;

  let config: HealthConfig | null | undefined = input.config;
  if (!config) {
    config = (await prisma.healthConfig.findUnique({
      where: { userId },
    })) as HealthConfig | null;
  }

  let assetRecords = input.assetRecords;
  if (!assetRecords) {
    assetRecords = await prisma.assetRecord.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  }

  let inventoryPlan = input.inventoryPlan;
  if (inventoryPlan === undefined) {
    inventoryPlan = await prisma.inventoryPlan.findUnique({
      where: { userId },
    });
  }

  const effectiveConfig = config || DEFAULT_CONFIG;
  const normalizedWeights = normalizeWeights({
    emergencyReserveWeight: Number(effectiveConfig.emergencyReserveWeight),
    assetAllocationWeight: Number(effectiveConfig.assetAllocationWeight),
    growthStabilityWeight: Number(effectiveConfig.growthStabilityWeight),
    inventoryTimelinessWeight: Number(effectiveConfig.inventoryTimelinessWeight),
  });

  const latestRecord =
    assetRecords.length > 0
      ? [...assetRecords].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0]
      : null;

  const cash = latestRecord ? Number(latestRecord.cash) : 0;
  const longTermInvest = latestRecord ? Number(latestRecord.longTermInvest) : 0;
  const stableBond = latestRecord ? Number(latestRecord.stableBond) : 0;

  const monthlyExpense = Number(effectiveConfig.monthlyExpense);
  const minEmergencyMonths = effectiveConfig.minEmergencyReserveMonths;
  const idealEmergencyMonths = effectiveConfig.idealEmergencyReserveMonths;
  const targetCashRatio = Number(effectiveConfig.targetCashRatio);
  const targetLongTermRatio = Number(effectiveConfig.targetLongTermInvestRatio);
  const targetStableBondRatio = Number(effectiveConfig.targetStableBondRatio);
  const volatilityWindow = effectiveConfig.volatilityWindowMonths;

  const emergencyReserve = calculateEmergencyReserveScore(
    cash,
    monthlyExpense,
    minEmergencyMonths,
    idealEmergencyMonths
  );
  emergencyReserve.weight = normalizedWeights.emergencyReserveWeight;

  const assetAllocation = calculateAssetAllocationScore(
    cash,
    longTermInvest,
    stableBond,
    targetCashRatio,
    targetLongTermRatio,
    targetStableBondRatio
  );
  assetAllocation.weight = normalizedWeights.assetAllocationWeight;

  const growthStability = calculateGrowthStabilityScore(assetRecords, volatilityWindow);
  growthStability.weight = normalizedWeights.growthStabilityWeight;

  const inventoryTimeliness = calculateInventoryTimelinessScore(
    inventoryPlan,
    inventoryPlan?.lastInventoryDate || null,
    latestRecord?.date || null
  );
  inventoryTimeliness.weight = normalizedWeights.inventoryTimelinessWeight;

  const totalScore = Math.round(
    emergencyReserve.score * emergencyReserve.weight +
      assetAllocation.score * assetAllocation.weight +
      growthStability.score * growthStability.weight +
      inventoryTimeliness.score * inventoryTimeliness.weight
  );

  const dataQuality = assessDataQuality(assetRecords, config ?? undefined, !!inventoryPlan);

  return {
    totalScore: Math.max(0, Math.min(100, totalScore)),
    emergencyReserve,
    assetAllocation,
    growthStability,
    inventoryTimeliness,
    dataQuality: dataQuality.quality,
    dataQualityNote: dataQuality.note,
    calculatedAt: new Date(),
  };
}

export async function saveHealthScore(
  userId: string,
  result: HealthScoreResult
) {
  return prisma.healthScore.create({
    data: {
      userId,
      totalScore: new Decimal(result.totalScore),
      emergencyReserveScore: new Decimal(result.emergencyReserve.score),
      assetAllocationScore: new Decimal(result.assetAllocation.score),
      growthStabilityScore: new Decimal(result.growthStability.score),
      inventoryTimelinessScore: new Decimal(result.inventoryTimeliness.score),
      emergencyReserveWeight: new Decimal(result.emergencyReserve.weight),
      assetAllocationWeight: new Decimal(result.assetAllocation.weight),
      growthStabilityWeight: new Decimal(result.growthStability.weight),
      inventoryTimelinessWeight: new Decimal(result.inventoryTimeliness.weight),
      emergencyReserveSuggestion: result.emergencyReserve.suggestion,
      assetAllocationSuggestion: result.assetAllocation.suggestion,
      growthStabilitySuggestion: result.growthStability.suggestion,
      inventoryTimelinessSuggestion: result.inventoryTimeliness.suggestion,
      dataQuality: result.dataQuality,
      dataQualityNote: result.dataQualityNote,
      calculatedAt: result.calculatedAt,
    },
  });
}

export async function recalculateAndSaveHealthScore(userId: string) {
  const result = await calculateHealthScore({ userId });
  return saveHealthScore(userId, result);
}

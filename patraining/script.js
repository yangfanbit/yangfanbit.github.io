// 专业交易记录系统
class ProfessionalTradingTracker {
    constructor() {
        this.transactions = [];
        this.currentDetailId = null;
        this.customAStockKey = 'astockCustomSymbols'; // 自选 A股 列表（localStorage 键）
        // A股 自动算费参数（可在此调整）
        this.astockFeeRates = {
            stampTax: 0.0005,      // 印花税 0.05%，仅卖出收取
            commission: 0.00015,   // 佣金 万1.5
            commissionMin: 5,      // 单笔最低佣金（元），不足按 5 元收
            transferFee: 0.00001   // 过户费 万0.1，双向收取
        };
        this.currentSort = {
            field: 'entryTime',
            direction: 'desc' // 'asc' or 'desc'
        };
        this.BACKUP_REMIND_DAYS = 7; // 超过该天数未备份则弹出提醒
        
        // 交易品种预设配置（market=市场，multiplier=合约乘数）
        this.symbolPresets = {
            // A股（1手=100股，数量按"手"录入，合约乘数=100）
            '600519': { name: '贵州茅台', market: 'A股', multiplier: 100 },
            '300750': { name: '宁德时代', market: 'A股', multiplier: 100 },
            '600036': { name: '招商银行', market: 'A股', multiplier: 100 },
            '000858': { name: '五粮液', market: 'A股', multiplier: 100 },
            '601318': { name: '中国平安', market: 'A股', multiplier: 100 },
            '600900': { name: '长江电力', market: 'A股', multiplier: 100 },
            '510300': { name: '沪深300ETF', market: 'A股', multiplier: 100 },
            '588000': { name: '科创50ETF', market: 'A股', multiplier: 100 },
            // 商品期货（合约乘数见交易所规则，数量按"手"录入）
            'RB': { name: '螺纹钢', market: '商品期货', multiplier: 10 },
            'HC': { name: '热卷', market: '商品期货', multiplier: 10 },
            'I':  { name: '铁矿石', market: '商品期货', multiplier: 100 },
            'J':  { name: '焦炭', market: '商品期货', multiplier: 100 },
            'JM': { name: '焦煤', market: '商品期货', multiplier: 60 },
            'CU': { name: '沪铜', market: '商品期货', multiplier: 5 },
            'AL': { name: '沪铝', market: '商品期货', multiplier: 5 },
            'ZN': { name: '沪锌', market: '商品期货', multiplier: 5 },
            'NI': { name: '沪镍', market: '商品期货', multiplier: 1 },
            'AU': { name: '黄金', market: '商品期货', multiplier: 1000 },
            'AG': { name: '白银', market: '商品期货', multiplier: 15 },
            'SC': { name: '原油', market: '商品期货', multiplier: 1000 },
            'FU': { name: '燃油', market: '商品期货', multiplier: 10 },
            'BU': { name: '沥青', market: '商品期货', multiplier: 10 },
            'M':  { name: '豆粕', market: '商品期货', multiplier: 10 },
            'Y':  { name: '豆油', market: '商品期货', multiplier: 10 },
            'P':  { name: '棕榈油', market: '商品期货', multiplier: 10 },
            'C':  { name: '玉米', market: '商品期货', multiplier: 10 },
            'SR': { name: '白糖', market: '商品期货', multiplier: 10 },
            'CF': { name: '棉花', market: '商品期货', multiplier: 5 },
            'TA': { name: 'PTA', market: '商品期货', multiplier: 5 },
            'MA': { name: '甲醇', market: '商品期货', multiplier: 10 },
            'RU': { name: '橡胶', market: '商品期货', multiplier: 10 },
            'AP': { name: '苹果', market: '商品期货', multiplier: 10 },
            'IF': { name: '沪深300股指', market: '商品期货', multiplier: 300 },
            'IC': { name: '中证500股指', market: '商品期货', multiplier: 200 },
            'IH': { name: '上证50股指', market: '商品期货', multiplier: 300 },
            // 外汇（兼容旧数据，数量按标准手）
            'XAUUSD': { name: '黄金/XAUUSD', market: '外汇', multiplier: 100 },
            'EURUSD': { name: '欧元/美元', market: '外汇', multiplier: 100000 },
            'GBPUSD': { name: '英镑/美元', market: '外汇', multiplier: 100000 },
            'USDJPY': { name: '美元/日元', market: '外汇', multiplier: 100000 },
            'BTCUSD': { name: '比特币', market: '外汇', multiplier: 1 },
            '其他': { name: '其他', market: '', multiplier: 100 }
        };
        

        // 同步初始化（UI / 事件 / 表单 / 品种选择 — 不依赖数据）
        this.initDateTimePickers();
        this.setupEventListeners();
        this.setupFormDefaults();
        this.initSorting();
        this.setupSymbolSelector();
        this.checkBackupReminder();
        this.updateFooterYear();


        this.bootstrap();

        // 初始化图表
        this.initCharts();
    }

    // 页脚年份自动更新为最新年份
    updateFooterYear() {
        const el = document.getElementById('footer-year');
        if (el) el.textContent = String(new Date().getFullYear());
    }

    // 本地时间格式化（避免 toISOString 的 UTC 偏移导致时间/日期错 8 小时）
    getLocalDateString(d) {
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    getLocalDateTimeString(d) {
        const pad = n => String(n).padStart(2, '0');
        return `${this.getLocalDateString(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // 初始化ECharts图表
    initCharts() {
        // 各周期盈亏柱状图
        this.chartCycle = echarts.init(document.getElementById('chart-cycle'));

        // 入场时段胜率折线图
        this.chartHourly = echarts.init(document.getElementById('chart-hourly'));

        // 平仓理由饼图
        this.chartExit = echarts.init(document.getElementById('chart-exit'));

        // 渲染图表
        this.renderCharts();

        // 响应窗口变化
        window.addEventListener('resize', () => {
            this.chartCycle.resize();
            this.chartHourly.resize();
            this.chartExit.resize();
        });
    }

    // 渲染所有图表
    renderCharts() {
        this.renderCycleChart();
        this.renderHourlyChart();
        this.renderExitChart();
    }

    // 渲染各周期盈亏柱状图
    renderCycleChart() {
        const cycleData = {};
        this.transactions.forEach(t => {
            if (t.exitPrice) {
                if (!cycleData[t.tradeCycle]) {
                    cycleData[t.tradeCycle] = 0;
                }
                cycleData[t.tradeCycle] += t.actualProfitLoss || 0;
            }
        });

        const cycles = Object.keys(cycleData);
        const values = cycles.map(c => cycleData[c]);

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: '{b}: ¥{c}'
            },
            xAxis: {
                type: 'category',
                data: cycles,
                axisLabel: { color: '#94a3b8' },
                axisLine: { lineStyle: { color: '#475569' } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: '#94a3b8',
                    formatter: '¥{value}'
                },
                axisLine: { lineStyle: { color: '#475569' } },
                splitLine: { lineStyle: { color: '#334155' } }
            },
            series: [{
                type: 'bar',
                data: values.map(v => ({
                    value: v,
                    itemStyle: {
                        color: v >= 0 ? '#ef4444' : '#10b981'
                    }
                })),
                barWidth: '50%',
                label: {
                    show: true,
                    position: 'top',
                    color: '#e2e8f0',
                    formatter: '¥{c}'
                }
            }],
            grid: { left: '10%', right: '10%', bottom: '15%', top: '10%' }
        };

        this.chartCycle.setOption(option);
    }

    // 渲染入场时段胜率折线图
    renderHourlyChart() {
        const hourlyStats = {};

        this.transactions.forEach(t => {
            if (t.exitPrice && t.entryTime) {
                const hour = new Date(t.entryTime.replace(' ', 'T')).getHours();
                if (!hourlyStats[hour]) {
                    hourlyStats[hour] = { total: 0, wins: 0 };
                }
                hourlyStats[hour].total++;
                if (t.actualProfitLoss > 0) {
                    hourlyStats[hour].wins++;
                }
            }
        });

        // 生成0-23小时的数据
        const hours = [];
        const winRates = [];
        for (let h = 0; h < 24; h++) {
            hours.push(h + '时');
            if (hourlyStats[h] && hourlyStats[h].total > 0) {
                winRates.push((hourlyStats[h].wins / hourlyStats[h].total * 100).toFixed(1));
            } else {
                winRates.push('-');
            }
        }

        const validData = winRates.map((v, i) => v === '-' ? null : [i, parseFloat(v)]).filter(v => v !== null);

        const option = {
            tooltip: {
                formatter: function(params) {
                    if (params && params.length > 0) {
                        return params[0].data[0] + '时: ' + params[0].data[1] + '%';
                    }
                    return '';
                }
            },
            xAxis: {
                type: 'category',
                data: hours,
                axisLabel: {
                    color: '#94a3b8',
                    interval: 2
                },
                axisLine: { lineStyle: { color: '#475569' } }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: {
                    color: '#94a3b8',
                    formatter: '{value}%'
                },
                axisLine: { lineStyle: { color: '#475569' } },
                splitLine: { lineStyle: { color: '#334155' } }
            },
            series: [{
                type: 'line',
                data: validData,
                smooth: true,
                lineStyle: { color: '#38bdf8', width: 2 },
                itemStyle: { color: '#38bdf8' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(56, 189, 248, 0.3)' },
                            { offset: 1, color: 'rgba(56, 189, 248, 0.05)' }
                        ]
                    }
                },
                label: {
                    show: true,
                    position: 'top',
                    color: '#38bdf8',
                    formatter: '{c}%'
                },
                connectNulls: true
            }],
            grid: { left: '10%', right: '10%', bottom: '15%', top: '10%' }
        };

        this.chartHourly.setOption(option);
    }

    // 渲染平仓理由饼图
    renderExitChart() {
        const exitData = {};
        this.transactions.forEach(t => {
            if (t.exitReason) {
                if (!exitData[t.exitReason]) {
                    exitData[t.exitReason] = 0;
                }
                exitData[t.exitReason]++;
            }
        });

        const data = Object.keys(exitData).map(key => ({
            name: key,
            value: exitData[key]
        }));

        const colors = ['#ef4444', '#10b981', '#38bdf8', '#fbbf24', '#8b5cf6', '#f97316'];

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}笔 ({d}%)'
            },
            legend: {
                orient: 'vertical',
                right: '5%',
                top: 'center',
                textStyle: { color: '#94a3b8' }
            },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['40%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 6,
                    borderColor: '#1e293b',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    color: '#e2e8f0',
                    formatter: '{b}: {c}'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                },
                data: data.map((item, index) => ({
                    ...item,
                    itemStyle: { color: colors[index % colors.length] }
                }))
            }]
        };

        this.chartExit.setOption(option);
    }
    
    init() {
        // 此方法保留供外部调用（无实际操作，构造器已拆分 init 为同步 + 异步两步）
    }


    // 异步引导：自动登录检测 → 加载数据 → 渲染
    // 引导：加载本地数据并渲染（纯本地模式，无云端）
    async bootstrap() {
        this.loadLocalData();
        this.renderTransactions();
        this.updateStats();
        this.renderCharts();
    }






    // 本地模式：从 localStorage 加载（CloudBase 不可用时的降级）
    loadLocalData() {
        this.loadTransactions();
    }

    
    // 初始化交易品种选择器
    setupSymbolSelector() {
        const symbolSelect = document.getElementById('trade-symbol');
        
        // 当交易品种改变时
        symbolSelect.addEventListener('change', (e) => {
            const selectedSymbol = e.target.value;
            this.updateSymbolPreset(selectedSymbol);
            this.calculateAllValues(); // 重新计算所有相关值
        });

        // 当交易市场改变时，套用该市场的默认值
        const marketSelect = document.getElementById('trade-market');
        if (marketSelect) {
            marketSelect.addEventListener('change', (e) => {
                this.applyMarketDefaults(e.target.value);
                this.calculateAllValues();
            });
        }
        
        // 设置默认值
        this.updateSymbolPreset(symbolSelect.value);

        // 渲染已保存的自选 A股 列表（持久化）
        this.renderCustomAStockOptions();
    }

    // 读取自选 A股 列表
    loadCustomAStocks() {
        try {
            return JSON.parse(localStorage.getItem(this.customAStockKey) || '[]');
        } catch (e) {
            return [];
        }
    }

    // 保存一只自选 A股（去重 + 持久化 + 即时注册到下拉）
    saveCustomAStock(name) {
        const list = this.loadCustomAStocks();
        if (!list.includes(name)) {
            list.push(name);
            try { localStorage.setItem(this.customAStockKey, JSON.stringify(list)); } catch (e) {}
        }
        // 注册到预设（视为 A股，1手=100股）并加入下拉
        this.symbolPresets[name] = { name, market: 'A股', multiplier: 100 };
        const group = document.getElementById('astock-group');
        if (group && !Array.from(group.options).some(o => o.value === name)) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            group.appendChild(opt);
        }
    }

    // 初始化时把已保存的自选 A股 渲染进下拉
    renderCustomAStockOptions() {
        const group = document.getElementById('astock-group');
        if (!group) return;
        this.loadCustomAStocks().forEach(name => {
            this.symbolPresets[name] = { name, market: 'A股', multiplier: 100 };
            if (!Array.from(group.options).some(o => o.value === name)) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                group.appendChild(opt);
            }
        });
    }
    
    // 更新交易品种预设值
    updateSymbolPreset(symbol) {
        const preset = this.symbolPresets[symbol] || { multiplier: 100 };
        const lotValueInput = document.getElementById('standard-lot-value');
        const customInput = document.getElementById('custom-symbol');

        // 默认隐藏手动输入框
        if (customInput) customInput.style.display = 'none';

        // A股（含手动输入）：合约乘数固定 1手=100股，锁定不可改
        const isAStock = preset.market === 'A股' || symbol === '__custom__';
        if (isAStock) {
            lotValueInput.value = 100;
            lotValueInput.disabled = true;
            lotValueInput.title = 'A股固定：1手 = 100股';
            lotValueInput.classList.add('input-locked');

            // 自动同步市场为 A股
            const marketSelect = document.getElementById('trade-market');
            if (marketSelect && !marketSelect.value) marketSelect.value = 'A股';
            this.applyMarketDefaults('A股');

            // 手动输入品种：展示文本框并聚焦
            if (symbol === '__custom__' && customInput) {
                customInput.style.display = 'block';
                customInput.focus();
            }
        } else {
            // 非 A股：合约乘数可编辑（按预设带入默认值）
            lotValueInput.disabled = false;
            lotValueInput.title = '';
            lotValueInput.classList.remove('input-locked');
            if (preset.multiplier) lotValueInput.value = preset.multiplier;

            // 若品种已绑定市场，自动同步市场选择
            if (preset.market) {
                const marketSelect = document.getElementById('trade-market');
                if (marketSelect && !marketSelect.value) marketSelect.value = preset.market;
                this.applyMarketDefaults(preset.market);
            }
        }

        // 重新计算所有值
        this.calculateAllValues();
    }

    // 根据市场设置表单默认值（A股默认做多，期货默认合约乘数等）
    applyMarketDefaults(market) {
        const directionSelect = document.getElementById('trade-direction');
        if (market === 'A股') {
            // A股以做多为主，默认多头
            if (directionSelect && !directionSelect.value) {
                directionSelect.value = '多';
            }
        }

        // 动态更新「数量/手数」标签与提示，避免把 股数 误当成 手数 录入
        this.updatePositionSizeLabel(market);
    }

    // 根据市场动态设置「手数」标签文案与提示
    updatePositionSizeLabel(market) {
        const labelText = document.getElementById('position-size-label-text');
        const hint = document.getElementById('position-size-hint');
        const lotLabel = document.getElementById('lot-label');
        // position-size 在三种市场下都是「手数」，区别只在 1手 代表的单位
        const map = {
            'A股':      { label: '手数（A股 1手=100股）', hint: 'A股：1手 = 100股，盈亏按此自动计算' },
            '商品期货': { label: '手数（合约）',         hint: '期货：1手 = 1张合约，盈亏按合约乘数计算' },
            '外汇':     { label: '手数（标准手）',       hint: '外汇：1标准手 = 100,000 基础货币' }
        };
        const cfg = map[market] || { label: '手数', hint: '' };
        if (labelText) labelText.textContent = cfg.label;
        if (hint) hint.textContent = cfg.hint;
        if (lotLabel) lotLabel.textContent = '手数: ';
    }
    
    // 更新小数位数提示
    updateDecimalPlacesHint(decimalPlaces) {
        // 这里可以添加小数位数提示，如果需要的话
    }
    
    // 计算标准手数量
    calculateStandardLots() {
        const positionSize = parseFloat(document.getElementById('position-size').value) || 0;
        const standardLots = positionSize; // 假设输入的就是标准手数量
        
        document.getElementById('standard-lots').textContent = standardLots.toFixed(2);
        return standardLots;
    }
    
    // 计算每点价值
    calculatePerPipValue() {
        const standardLots = this.calculateStandardLots();
        const lotValue = parseFloat(document.getElementById('standard-lot-value').value) || 0;
        const perPipValue = standardLots * lotValue;
        
        document.getElementById('per-pip-value').textContent = `¥${perPipValue.toFixed(2)}`;
        return perPipValue;
    }
    
    // 计算止损点数
    calculateStopPips() {
        const entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
        const stopLoss = parseFloat(document.getElementById('initial-stop').value) || 0;
        const direction = document.getElementById('trade-direction').value;
        
        if (entryPrice > 0 && stopLoss > 0) {
            let pips;
            if (direction === '多') {
                pips = Math.abs(entryPrice - stopLoss);
            } else { // 空
                pips = Math.abs(stopLoss - entryPrice);
            }
            
            document.getElementById('stop-pips').textContent = pips.toFixed(4);
            return pips;
        }
        
        document.getElementById('stop-pips').textContent = '0.0000';
        return 0;
    }
    
    // 计算目标点数
    calculateTargetPips() {
        const entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
        const target = parseFloat(document.getElementById('initial-target').value) || 0;
        const direction = document.getElementById('trade-direction').value;
        
        if (entryPrice > 0 && target > 0) {
            let pips;
            if (direction === '多') {
                pips = Math.abs(target - entryPrice);
            } else { // 空
                pips = Math.abs(entryPrice - target);
            }
            
            document.getElementById('target-pips').textContent = pips.toFixed(4);
            return pips;
        }
        
        document.getElementById('target-pips').textContent = '0.0000';
        return 0;
    }
    
    // 计算风险点数（初始风险）
    calculateRiskPips() {
        const entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
        const stopLoss = parseFloat(document.getElementById('initial-stop').value) || 0;
        const direction = document.getElementById('trade-direction').value;
        
        if (entryPrice > 0 && stopLoss > 0) {
            let riskPips;
            if (direction === '多') {
                riskPips = entryPrice - stopLoss;
            } else { // 空
                riskPips = stopLoss - entryPrice;
            }
            
            document.getElementById('risk-pips').textContent = Math.abs(riskPips).toFixed(4);
            return riskPips;
        }
        
        document.getElementById('risk-pips').textContent = '0.0000';
        return 0;
    }
    
    // 计算风险价值（初始风险价值）
    calculateRiskValue() {
        const riskPips = Math.abs(this.calculateRiskPips());
        const perPipValue = this.calculatePerPipValue();
        const riskValue = riskPips * perPipValue;
        
        document.getElementById('risk-value').textContent = `¥${riskValue.toFixed(2)}`;
        return riskValue;
    }
    
    // 计算实际风险百分比（相对于初始风险）
    calculateActualRiskPercent() {
        const initialRiskValue = this.calculateRiskValue();
        const actualRiskInput = parseFloat(document.getElementById('actual-risk').value) || 0;
        
        if (initialRiskValue > 0 && actualRiskInput > 0) {
            const percent = (actualRiskInput / initialRiskValue) * 100;
            const percentElement = document.getElementById('actual-risk-percent');
            
            percentElement.textContent = `${percent.toFixed(1)}%`;
            
            // 根据百分比设置颜色
            percentElement.className = '';
            if (percent <= 50) {
                percentElement.classList.add('low');
            } else if (percent <= 100) {
                // 50%-100% 之间保持默认颜色
            } else {
                percentElement.classList.add('high');
            }
            
            return percent;
        }
        
        document.getElementById('actual-risk-percent').textContent = '0%';
        document.getElementById('actual-risk-percent').className = '';
        return 0;
    }
    
    // 计算所有相关值
    calculateAllValues() {
        // 计算基本值
        this.calculateStandardLots();
        this.calculatePerPipValue();
        
        // 计算点数
        this.calculateStopPips();
        this.calculateTargetPips();
        this.calculateRiskPips();
        this.calculateRiskValue();
        
        // 计算实际风险百分比
        this.calculateActualRiskPercent();
        
        // 计算风险回报比
        const entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
        const stopLoss = parseFloat(document.getElementById('initial-stop').value) || 0;
        const target = parseFloat(document.getElementById('initial-target').value) || 0;
        const direction = document.getElementById('trade-direction').value;
        
        if (entryPrice > 0 && stopLoss > 0 && target > 0) {
            let risk, reward;
            
            if (direction === '多') {
                risk = entryPrice - stopLoss;
                reward = target - entryPrice;
            } else { // 空
                risk = stopLoss - entryPrice;
                reward = entryPrice - target;
            }
            
            if (risk > 0 && reward > 0) {
                const ratio = (reward / risk).toFixed(2);
                document.getElementById('risk-reward').value = `1:${ratio}`;
            }
        }

        // A股 自动算费
        this.calculateAStockFee();
    }

    // A股 自动算费：印花税(卖出0.05%) + 佣金(万1.5,最低5元/笔) + 过户费(万0.1,双向)
    calculateAStockFee() {
        const market = document.getElementById('trade-market').value;
        const feeInput = document.getElementById('fee');

        // 非 A股：保持手动可编辑
        if (market !== 'A股') {
            feeInput.disabled = false;
            feeInput.classList.remove('input-locked');
            feeInput.title = '';
            feeInput.placeholder = 'A股自动计算；期货/外汇手动填';
            return;
        }

        // A股：自动计算并锁定
        feeInput.disabled = true;
        feeInput.classList.add('input-locked');
        feeInput.title = 'A股自动计算：印花税(卖出0.05%)+佣金(万1.5,最低5元/笔)+过户费(万0.1,双向)';
        feeInput.placeholder = '自动计算（不可手动）';

        const multiplier = parseFloat(document.getElementById('standard-lot-value').value) || 0;
        const qty = parseFloat(document.getElementById('position-size').value) || 0;
        const entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
        const exitPrice = parseFloat(document.getElementById('exit-price').value) || 0;
        const direction = document.getElementById('trade-direction').value;

        // 成交金额 = 价格 × 股数（股数 = 手数 × 合约乘数）
        const entryAmount = entryPrice * qty * multiplier;   // 开仓金额
        const exitAmount = exitPrice ? exitPrice * qty * multiplier : 0; // 平仓金额

        const r = this.astockFeeRates;
        // 佣金、过户费 双向（开仓、平仓各收一次）
        const commissionBuy = entryAmount > 0 ? Math.max(entryAmount * r.commission, r.commissionMin) : 0;
        const commissionSell = exitAmount > 0 ? Math.max(exitAmount * r.commission, r.commissionMin) : 0;
        const transferBuy = entryAmount * r.transferFee;
        const transferSell = exitAmount * r.transferFee;
        // 印花税仅在实际"卖出"时收：做多→平仓(卖)收；做空(融券)→开仓(卖开)收
        const stampLegAmount = direction === '空' ? entryAmount : exitAmount;
        const stampTax = stampLegAmount * r.stampTax;

        const total = commissionBuy + commissionSell + transferBuy + transferSell + stampTax;
        feeInput.value = total.toFixed(2);
        return total;
    }
    
    // 初始化时间选择器
    initDateTimePickers() {
        // 中文配置
        const chineseConfig = {
            locale: "zh",
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            time_24hr: true,
            minuteIncrement: 1
        };
        
        // 开仓时间选择器
        flatpickr("#entry-time", chineseConfig);
        
        // 平仓时间选择器
        flatpickr("#exit-time", chineseConfig);
    }
    
    // 设置表单默认值
    setupFormDefaults() {
        // 设置默认开仓时间为当前时间（本地时区）
        const now = new Date();
        document.getElementById('entry-time').value = this.getLocalDateTimeString(now);
        
        // 设置日期搜索的默认值（最近30天，本地时区）
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        document.getElementById('date-from').value = this.getLocalDateString(thirtyDaysAgo);
        document.getElementById('date-to').value = this.getLocalDateString(new Date());
        
        // 为部分字段添加计算逻辑
        this.setupCalculations();
    }
    
    // 设置字段计算逻辑
    setupCalculations() {
        // 监听相关字段的变化，触发计算（不包括实际风险）
        const fieldsToWatch = [
            'trade-symbol', 'standard-lot-value', 'position-size',
            'entry-price', 'exit-price', 'initial-stop', 'initial-target', 'trade-direction'
        ];
        
        fieldsToWatch.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.calculateAllValues();
            });
            document.getElementById(id).addEventListener('change', () => {
                this.calculateAllValues();
            });
        });
        
        // 监听实际风险输入变化，只更新百分比
        document.getElementById('actual-risk').addEventListener('input', () => {
            this.calculateActualRiskPercent();
        });
    }
    
    // 初始化排序功能
    initSorting() {
        // 为表头添加排序事件监听器
        const sortableHeaders = document.querySelectorAll('th[data-sort]');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-sort');
                this.sortTransactions(field);
                this.updateSortIndicators(field);
            });
        });
    }
    
    // 更新排序指示器
    updateSortIndicators(currentField) {
        // 清除所有排序指示器
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            
            // 更新图标
            const icon = header.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-sort';
            }
        });
        
        // 设置当前排序字段的指示器
        const currentHeader = document.querySelector(`th[data-sort="${currentField}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sort-${this.currentSort.direction}`);
            
            // 更新图标
            const icon = currentHeader.querySelector('i');
            if (icon) {
                if (this.currentSort.direction === 'asc') {
                    icon.className = 'fas fa-sort-up';
                } else {
                    icon.className = 'fas fa-sort-down';
                }
            }
        }
    }
    
    // 从本地存储加载交易记录
    loadTransactions() {
        const savedTransactions = localStorage.getItem('professionalTradingTransactions');
        if (savedTransactions) {
            this.transactions = JSON.parse(savedTransactions);
        }
    }
    
    // 保存交易记录到本地存储
    saveTransactions() {
        localStorage.setItem('professionalTradingTransactions', JSON.stringify(this.transactions));
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 表单提交事件
        // 在 setupEventListeners 中找到这一行
        document.getElementById('transaction-form').addEventListener('submit', async (e) => { // 加上 async
            e.preventDefault();
            await this.addTransaction(); // 加上 await
        });
        
        // 重置表单按钮
        document.getElementById('reset-form').addEventListener('click', () => {
            document.getElementById('transaction-form').reset();
            this.setupFormDefaults();
            this.exitEditMode(); // 若在编辑态，重置时一并退出
            // 重置后重新同步 合约乘数锁定 / 手续费自动计算 等 JS 状态（reset 不会清除 disabled）
            this.updateSymbolPreset(document.getElementById('trade-symbol').value);
            this.calculateAllValues();
        });
        
        // 搜索功能
        document.getElementById('search').addEventListener('input', () => {
            this.renderTransactions();
        });
        
        // 筛选功能
        document.getElementById('filter-direction').addEventListener('change', () => {
            this.renderTransactions();
        });
        // 周期筛选
        document.getElementById('filter-cycle').addEventListener('change', () => {
            this.renderTransactions();
        });
        // 类型筛选
        document.getElementById('filter-type').addEventListener('change', () => {
            this.renderTransactions();
        });
        // 日期范围筛选
        document.getElementById('date-from').addEventListener('change', () => {
            this.renderTransactions();
        });
        
        document.getElementById('date-to').addEventListener('change', () => {
            this.renderTransactions();
        });
        
        // 添加清除日期按钮事件
        this.addClearDateButtons();
        
        // 添加快速筛选按钮
        this.addQuickFilterButtons();
        
        // 导出数据按钮
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        // 导出 Markdown 按钮
        document.getElementById('export-markdown').addEventListener('click', () => {
            this.exportMarkdown();
        });

        // 备份提醒：立即备份
        document.getElementById('backup-now').addEventListener('click', () => {
            this.downloadTransactionsJSON(true);
        });

        // 备份提醒：本次忽略
        document.getElementById('backup-dismiss').addEventListener('click', () => {
            const banner = document.getElementById('backup-reminder');
            if (banner) banner.style.display = 'none';
        });

        // 自动备份开关
        const autoBackupToggle = document.getElementById('auto-backup');
        autoBackupToggle.checked = this.isAutoBackupEnabled();
        autoBackupToggle.addEventListener('change', (e) => {
            this.setAutoBackup(e.target.checked);
            this.showMessage(e.target.checked ? '已开启保存后自动备份。' : '已关闭自动备份。', 'info');
        });

        
        // 导入数据按钮
        document.getElementById('import-data').addEventListener('click', () => {
            this.showImportModal();
        });
        
        // 清空所有记录按钮
        document.getElementById('clear-all').addEventListener('click', () => {
            if (this.transactions.length === 0) {
                this.showMessage('当前没有交易记录可清除。', 'info');
                return;
            }

            if (confirm('确定要清空所有交易记录吗？此操作不可撤销。')) {
                this.clearAllTransactions();
            }
        });

        // 导入模态框事件
        document.getElementById('confirm-import').addEventListener('click', () => {
            this.importData();
        });
        
        document.getElementById('cancel-import').addEventListener('click', () => {
            this.hideImportModal();
        });
        
        // 详情模态框关闭事件
        document.getElementById('close-detail').addEventListener('click', () => {
            this.hideDetailModal();
        });
        
        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // 文件上传预览
        document.getElementById('screenshot').addEventListener('change', (e) => {
            this.previewImage(e.target);
        });
        
        // 添加实际风险建议按钮
        this.addActualRiskSuggestions();
    }
    
    // 添加实际风险建议功能
    addActualRiskSuggestions() {
        const actualRiskInput = document.getElementById('actual-risk');
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'actual-risk-suggestions';
        suggestionsContainer.innerHTML = `
            <div class="suggestion-title">风险建议:</div>
            <div class="suggestion-buttons">
                <button type="button" class="suggestion-btn" data-percent="50">50%（半仓风险）</button>
                <button type="button" class="suggestion-btn" data-percent="100">100%（全仓风险）</button>
                <button type="button" class="suggestion-btn" data-percent="25">25%（四分之一）</button>
            </div>
        `;
        
        // 插入到实际风险输入框后面
        actualRiskInput.parentNode.parentNode.appendChild(suggestionsContainer);
        
        // 为建议按钮添加事件
        suggestionsContainer.querySelectorAll('.suggestion-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const percent = parseFloat(e.target.getAttribute('data-percent'));
                const initialRisk = this.calculateRiskValue();
                const suggestedRisk = (initialRisk * percent / 100).toFixed(2);
                
                actualRiskInput.value = suggestedRisk;
                this.calculateActualRiskPercent();
            });
        });
    }
    
    // 添加清除日期按钮
    addClearDateButtons() {
        // 为日期输入框添加清除按钮
        const dateInputs = ['date-from', 'date-to'];
        
        dateInputs.forEach(id => {
            const input = document.getElementById(id);
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'clear-date-btn';
            clearBtn.innerHTML = '<i class="fas fa-times"></i>';
            clearBtn.title = '清除日期';
            
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                input.value = '';
                this.renderTransactions();
            });
            
            // 将清除按钮添加到输入框后面
            input.parentNode.insertBefore(clearBtn, input.nextSibling);
        });
    }
    
    // 添加快速筛选按钮
    addQuickFilterButtons() {
        // 创建快速筛选按钮容器
        const quickFilterContainer = document.createElement('div');
        quickFilterContainer.className = 'quick-filter-buttons';
        
        // 定义快速筛选选项
        const quickFilters = [
            { label: '今天', days: 0 },
            { label: '最近7天', days: 7 },
            { label: '最近30天', days: 30 },
            { label: '本月', special: 'thisMonth' },
            { label: '上月', special: 'lastMonth' }
        ];
        
        // 创建按钮
        quickFilters.forEach(filter => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'quick-filter-btn';
            button.textContent = filter.label;
            
            button.addEventListener('click', () => {
                this.applyQuickFilter(filter);
                
                // 更新按钮状态
                document.querySelectorAll('.quick-filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });
            
            quickFilterContainer.appendChild(button);
        });
        
        // 将快速筛选按钮添加到搜索区域
        const searchFilter = document.querySelector('.search-filter');
        searchFilter.parentNode.insertBefore(quickFilterContainer, searchFilter.nextSibling);
    }
    
    // 应用快速筛选
    applyQuickFilter(filter) {
        const today = new Date();
        let dateFrom, dateTo;
        
        if (filter.special === 'thisMonth') {
            dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
            dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (filter.special === 'lastMonth') {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            dateFrom = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            dateTo = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        } else {
            dateFrom = new Date();
            dateFrom.setDate(today.getDate() - filter.days);
            dateTo = today;
        }
        
        // 设置日期输入框的值（本地时区）
        document.getElementById('date-from').value = this.getLocalDateString(dateFrom);
        document.getElementById('date-to').value = this.getLocalDateString(dateTo);
        
        // 重新渲染交易记录
        this.renderTransactions();
    }
    
    // 添加新交易
   // 表单数值校验：返回错误信息字符串，校验通过返回 null
   validateTransactionForm() {
       const qty = parseFloat(document.getElementById('position-size').value);
       const entryPrice = parseFloat(document.getElementById('entry-price').value);
       const exitRaw = document.getElementById('exit-price').value;
       const exitPrice = exitRaw ? parseFloat(exitRaw) : null;

       if (!isFinite(qty) || qty <= 0) {
           document.getElementById('position-size').focus();
           return '请填写有效的「手数」，必须大于 0';
       }
       if (!isFinite(entryPrice) || entryPrice <= 0) {
           document.getElementById('entry-price').focus();
           return '请填写有效的「开仓价格」，必须大于 0';
       }
       if (exitPrice !== null && (!isFinite(exitPrice) || exitPrice <= 0)) {
           document.getElementById('exit-price').focus();
           return '「平仓价格」若填写，必须大于 0';
       }
       return null;
   }

   async addTransaction() {
        // 获取表单数据
        const tradeCycle = document.getElementById('trade-cycle').value;
        const tradeType = document.getElementById('trade-type').value;
        const tradeBackground = document.getElementById('trade-background').value.trim();
        const tradeDirection = document.getElementById('trade-direction').value;
        const tradeSymbolRaw = document.getElementById('trade-symbol').value;
        // 手动输入的 A股 品种：取文本框内容
        let tradeSymbol = tradeSymbolRaw;
        let tradeMarket = document.getElementById('trade-market').value;
        if (tradeSymbolRaw === '__custom__') {
            const customVal = document.getElementById('custom-symbol').value.trim();
            if (!customVal) {
                alert('请输入 A股 品种名称或代码');
                return;
            }
            tradeSymbol = customVal;
            tradeMarket = tradeMarket || 'A股';
            // 记入自选列表（下次直接在下拉选择）
            this.saveCustomAStock(customVal);
        }

        // 数值校验（手数/价格必须合法），不合法则中止保存
        const validationError = this.validateTransactionForm();
        if (validationError) {
            alert(validationError);
            return;
        }

        const standardLotValue = parseFloat(document.getElementById('standard-lot-value').value);
        const entryTime = document.getElementById('entry-time').value;
        const positionSize = parseFloat(document.getElementById('position-size').value);
        const entryPrice = parseFloat(document.getElementById('entry-price').value);
        const entrySignal = document.getElementById('entry-signal').value;
        const entryReason = document.getElementById('entry-reason').value.trim();
        const initialStop = parseFloat(document.getElementById('initial-stop').value);
        const initialTarget = parseFloat(document.getElementById('initial-target').value);
        const actualRisk = parseFloat(document.getElementById('actual-risk').value) || 0; // 手动输入
        const exitTime = document.getElementById('exit-time').value;
        const exitPrice = parseFloat(document.getElementById('exit-price').value) || null;
        const exitReason = document.getElementById('exit-reason').value;
        const notes = document.getElementById('notes').value.trim();
        const fee = parseFloat(document.getElementById('fee').value) || 0; // 手续费/税费
        
        // 获取计算值
        const stopPips = parseFloat(document.getElementById('stop-pips').textContent) || 0;
        const targetPips = parseFloat(document.getElementById('target-pips').textContent) || 0;
        const riskPips = parseFloat(document.getElementById('risk-pips').textContent) || 0;
        const perPipValue = parseFloat(document.getElementById('per-pip-value').textContent.replace(/[¥$]/g, '')) || 0;
        const initialRiskValue = this.calculateRiskValue(); // 初始风险价值
        const actualRiskPercent = this.calculateActualRiskPercent(); // 实际风险百分比
        
        // 获取风险回报比
        const riskReward = document.getElementById('risk-reward').value;
        
        // 处理交易截图（前端模拟，实际需要后端支持）
        const screenshotFile = document.getElementById('screenshot').files[0];
        let screenshotData = null;

        if (screenshotFile) {
            // 使用 Promise 读取 Base64
            const base64String = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(screenshotFile);
            });

            screenshotData = {
                fileName: screenshotFile.name,
                fileSize: screenshotFile.size,
                fileType: screenshotFile.type,
                previewUrl: base64String // 这里存储的是永久的 Base64 数据
            };
        } else if (this._editScreenshotBackup) {
            // 编辑模式且未重新选择文件：保留原截图
            screenshotData = this._editScreenshotBackup;
        }
        
        // 计算实际盈亏和风险回报比
        let actualProfitLoss = 0;
        let actualRiskReward = '';
        
        if (exitPrice) {
            // 修正计算：使用每点价值计算盈亏
            const priceDiff = Math.abs(exitPrice - entryPrice);
            const perPipValueCurrent = positionSize * standardLotValue;
            
            if (tradeDirection === '多') {
                actualProfitLoss = (exitPrice - entryPrice) * perPipValueCurrent;
            } else { // 空
                actualProfitLoss = (entryPrice - exitPrice) * perPipValueCurrent;
            }

            // 扣除手续费/税费（A股印花税+佣金+过户费，期货手续费等）
            actualProfitLoss -= fee;
            
            // 计算实际风险回报比（使用实际风险）
            if (actualRisk > 0 && actualProfitLoss !== 0) {
                const ratio = Math.abs(actualProfitLoss / actualRisk).toFixed(2);
                actualRiskReward = actualProfitLoss >= 0 ? `1:${ratio}` : `-1:${ratio}`;
            }
        }
        
        // 创建交易对象
        const transaction = {
            id: Date.now(), // 使用时间戳作为唯一ID
            tradeCycle,
            tradeType,
            tradeBackground,
            tradeDirection,
            tradeSymbol,
            tradeMarket,
            standardLotValue,
            fee,
            entryTime,
            positionSize,
            entryPrice,
            entrySignal,
            entryReason,
            initialStop,
            initialTarget,
            stopPips,
            targetPips,
            riskPips,
            perPipValue,
            initialRiskValue, // 初始风险价值
            actualRisk, // 手动输入的实际风险
            actualRiskPercent, // 实际风险百分比
            riskReward,
            exitTime: exitTime || null,
            exitPrice,
            exitReason: exitReason || null,
            actualProfitLoss,
            actualRiskReward,
            screenshot: screenshotData,
            notes,
            createdAt: new Date().toISOString()
        };

        // 编辑模式：按 id 原地更新（保持原位置、保留原 id 与 createdAt）
        const editingIdRaw = document.getElementById('editing-id').value;
        const isEditing = !!editingIdRaw;
        if (isEditing) {
            const editingId = parseInt(editingIdRaw, 10);
            const idx = this.transactions.findIndex(t => t.id === editingId);
            if (idx !== -1) {
                const old = this.transactions[idx];
                transaction.id = old.id;
                transaction.createdAt = old.createdAt;
                this.transactions[idx] = transaction; // 原地替换
            } else {
                // 极端情况：编辑目标已不存在，退化为新增
                this.transactions.unshift(transaction);
            }
        } else {
            // 新增：插入到开头，使最新记录显示在最上面
            this.transactions.unshift(transaction);
        }
        
        // 保存到本地存储（缓存）
        this.saveTransactions();


        // 若开启"保存后自动备份"，静默下载一份 JSON 备份
        if (this.isAutoBackupEnabled()) {
            this.downloadTransactionsJSON(false);
        }

        // 重新渲染交易列表
        this.renderTransactions();
        
        // 更新统计信息
        this.updateStats();
        
        // 重置表单
        document.getElementById('transaction-form').reset();
        this.setupFormDefaults();
        this.exitEditMode(); // 恢复标题/按钮、清空 editing-id 与截图备份
        
        // 清除文件预览
        document.getElementById('file-preview').innerHTML = '';
        
        // 显示成功消息
        this.showMessage(isEditing ? '交易记录更新成功！' : '交易记录添加成功！', 'success');

        // 更新图表
        this.renderCharts();
    }
    
    // 预览上传的图片
    previewImage(input) {
        const preview = document.getElementById('file-preview');
        
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                preview.innerHTML = `
                    <div class="image-preview">
                        <p>已选择文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>
                        <img src="${e.target.result}" alt="预览" style="max-width: 200px; max-height: 150px; margin-top: 10px; border-radius: 4px;">
                    </div>
                `;
            };
            
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    }
    
    // 删除交易记录
    deleteTransaction(id) {
        // 从数组中移除指定ID的交易
        this.transactions = this.transactions.filter(transaction => transaction.id !== id);
        
        // 保存到本地存储
        this.saveTransactions();

        
        // 重新渲染交易列表
        this.renderTransactions();
        
        // 更新统计信息
        this.updateStats();
        
        // 显示消息
        this.showMessage('交易记录已删除。', 'info');

        // 更新图表
        this.renderCharts();
    }

    // 编辑交易记录：把指定记录回填到表单并进入编辑态
    editTransaction(id) {
        const t = this.transactions.find(x => x.id === id);
        if (!t) return;

        const setVal = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.value = (val === null || val === undefined) ? '' : val;
        };

        // 1) 回填基础字段
        setVal('trade-market', t.tradeMarket || '');
        setVal('trade-cycle', t.tradeCycle || '');
        setVal('trade-type', t.tradeType || '');
        setVal('trade-direction', t.tradeDirection || '');
        setVal('trade-symbol', t.tradeSymbol || '');
        setVal('trade-background', t.tradeBackground || '');
        setVal('entry-time', t.entryTime || '');
        setVal('entry-signal', t.entrySignal || '');
        setVal('entry-reason', t.entryReason || '');
        setVal('position-size', t.positionSize);
        setVal('entry-price', t.entryPrice);
        setVal('initial-stop', t.initialStop);
        setVal('initial-target', t.initialTarget);
        setVal('actual-risk', t.actualRisk);
        setVal('exit-time', t.exitTime || '');
        setVal('exit-price', t.exitPrice);
        setVal('exit-reason', t.exitReason || '');
        setVal('notes', t.notes || '');
        setVal('fee', t.fee);

        // 2) 重新应用品种预设（锁定/解锁 合约乘数、市场默认值）
        this.updateSymbolPreset(t.tradeSymbol || '');
        // 还原该记录自身保存的合约乘数与市场（保留录入当时的值）
        const lotInput = document.getElementById('standard-lot-value');
        if (lotInput && t.standardLotValue != null) lotInput.value = t.standardLotValue;
        const marketSel = document.getElementById('trade-market');
        if (marketSel && t.tradeMarket) marketSel.value = t.tradeMarket;
        this.updatePositionSizeLabel(t.tradeMarket || '');

        // 3) 截图：保留原截图，除非用户在编辑时重新选择文件
        this._editScreenshotBackup = t.screenshot || null;
        const preview = document.getElementById('file-preview');
        if (preview) {
            preview.innerHTML = (t.screenshot && t.screenshot.previewUrl)
                ? `<div class="image-preview"><p>当前截图：${t.screenshot.fileName || ''}</p>` +
                  `<img src="${t.screenshot.previewUrl}" alt="预览" style="max-width:200px;max-height:150px;margin-top:10px;border-radius:4px;"></div>`
                : '';
        }

        // 4) 进入编辑态：写入 editing-id、切换标题与按钮文案
        document.getElementById('editing-id').value = id;
        document.getElementById('form-heading').innerHTML = '<i class="fas fa-edit"></i> 编辑交易记录';
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> 更新交易记录';

        // 5) 重算派生值并滚动到表单
        this.calculateAllValues();
        document.getElementById('transaction-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 退出编辑态（恢复表单标题/按钮、清空 editing-id 与截图备份）
    exitEditMode() {
        document.getElementById('editing-id').value = '';
        this._editScreenshotBackup = null;
        document.getElementById('form-heading').innerHTML = '<i class="fas fa-plus-circle"></i> 添加交易记录';
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> 保存交易记录';
    }

    // 清空所有交易记录
    clearAllTransactions() {
        this.transactions = [];
        this.saveTransactions();
        this.exitEditMode(); // 清空后任何编辑目标均已失效
        this.renderTransactions();
        this.updateStats();
        this.showMessage('所有交易记录已清空。', 'info');

        // 更新图表
        this.renderCharts();
    }
    
    // 排序交易记录
    sortTransactions(field) {
        // 如果点击的是当前排序字段，则切换排序方向
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // 否则设置新的排序字段，默认降序
            this.currentSort.field = field;
            this.currentSort.direction = 'desc';
        }
        
        // 根据字段和方向排序
        this.transactions.sort((a, b) => {
            let aValue = a[field];
            let bValue = b[field];
            
            // 处理特殊字段
            if (field === 'entryTime' || field === 'exitTime') {
                // 将时间字符串转换为时间戳进行比较
                aValue = aValue ? new Date(aValue.replace(' ', 'T')).getTime() : 0;
                bValue = bValue ? new Date(bValue.replace(' ', 'T')).getTime() : 0;
            }
            
            // 处理数值字段
            if (['positionSize', 'entryPrice', 'initialStop', 'initialTarget', 
                 'exitPrice', 'actualProfitLoss', 'actualRisk', 'standardLotValue',
                 'perPipValue', 'initialRiskValue', 'actualRiskPercent'].includes(field)) {
                aValue = aValue || 0;
                bValue = bValue || 0;
            }
            
            // 处理字符串字段（交易品种、周期、方向等）
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }
            
            // 排序比较
            let result = 0;
            if (aValue < bValue) result = -1;
            if (aValue > bValue) result = 1;
            
            // 根据排序方向调整结果
            return this.currentSort.direction === 'asc' ? result : -result;
        });
        
        // 重新渲染交易列表
        this.renderTransactions();
    }
    
    // 渲染交易列表
    renderTransactions() {
        const tbody = document.getElementById('transactions-body');
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const filterDirection = document.getElementById('filter-direction').value;
        const filterCycle = document.getElementById('filter-cycle').value;
        const filterType = document.getElementById('filter-type').value;
        const filterMarket = document.getElementById('filter-market').value;
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        
        // 清空表格内容
        tbody.innerHTML = '';
        
        // 筛选交易记录
        let filteredTransactions = this.transactions.filter(transaction => {
            // 关键词搜索
            const matchesSearch = 
                transaction.tradeBackground.toLowerCase().includes(searchTerm) || 
                (transaction.notes && transaction.notes.toLowerCase().includes(searchTerm)) ||
                transaction.tradeSymbol.toLowerCase().includes(searchTerm);
            
            // 方向筛选
            const matchesDirection = !filterDirection || transaction.tradeDirection === filterDirection;
            
            // 市场筛选
            const matchesMarket = !filterMarket || (transaction.tradeMarket || '') === filterMarket;
            
            // 周期筛选
            const matchesCycle = !filterCycle || transaction.tradeCycle === filterCycle;

            // 类型筛选
            const matchesType = !filterType || transaction.tradeType === filterType;
            
            // 日期范围筛选
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const entryDate = transaction.entryTime.split(' ')[0]; // 获取日期部分
                
                if (dateFrom && entryDate < dateFrom) {
                    matchesDate = false;
                }
                
                if (dateTo && entryDate > dateTo) {
                    matchesDate = false;
                }
            }
            
            return matchesSearch && matchesDirection && matchesMarket && matchesCycle && matchesDate && matchesType;
        });
        
        // 如果没有任何交易记录，显示空状态
        if (filteredTransactions.length === 0) {
            tbody.innerHTML = `
                <tr id="no-transactions">
                    <td colspan="13" class="empty-message">
                        <i class="fas fa-info-circle"></i> 
                        ${this.transactions.length === 0 ? 
                            '暂无交易记录，请添加您的第一笔交易' : 
                            '没有找到匹配的交易记录'}
                    </td>
                </tr>
            `;
            return;
        }
        
        // 应用当前排序
        if (this.currentSort.field) {
            filteredTransactions = [...filteredTransactions]; // 创建副本
            filteredTransactions.sort((a, b) => {
                let aValue = a[this.currentSort.field];
                let bValue = b[this.currentSort.field];
                
                // 处理特殊字段
                if (this.currentSort.field === 'entryTime' || this.currentSort.field === 'exitTime') {
                    aValue = aValue ? new Date(aValue.replace(' ', 'T')).getTime() : 0;
                    bValue = bValue ? new Date(bValue.replace(' ', 'T')).getTime() : 0;
                }
                
                // 处理数值字段
                if (['positionSize', 'entryPrice', 'initialStop', 'initialTarget', 
                     'exitPrice', 'actualProfitLoss', 'actualRisk', 'standardLotValue',
                     'perPipValue', 'initialRiskValue', 'actualRiskPercent'].includes(this.currentSort.field)) {
                    aValue = aValue || 0;
                    bValue = bValue || 0;
                }
                
                // 处理字符串字段
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }
                
                let result = 0;
                if (aValue < bValue) result = -1;
                if (aValue > bValue) result = 1;
                
                return this.currentSort.direction === 'asc' ? result : -result;
            });
        }
        
        // 渲染交易记录行
        filteredTransactions.forEach(transaction => {
            const entryTime = transaction.entryTime.split(' ')[0]; // 只显示日期
            const profitLoss = transaction.actualProfitLoss || 0;
            const profitClass = profitLoss >= 0 ? 'profit' : 'loss';
            const directionClass = transaction.tradeDirection === '多' ? 'direction-long' : 'direction-short';
            
            // 为不同交易品种添加不同颜色类
            const symbolClass = this.getSymbolClass(transaction.tradeSymbol, transaction.tradeMarket);
            
            // 计算实际风险百分比提示
            const riskPercent = transaction.actualRiskPercent || 0;
            let riskPercentText = '';
            if (riskPercent > 0) {
                riskPercentText = `<span class="risk-percent">(${riskPercent.toFixed(1)}%)</span>`;
            }
            
            const row = document.createElement('tr');
            row.setAttribute('data-id', transaction.id);
            row.innerHTML = `
                <td>${entryTime}</td>
                <td>${transaction.tradeCycle}</td>
                <td>${transaction.tradeType}</td>
                <td class="${directionClass}">${transaction.tradeDirection === '多' ? '多头' : '空头'}</td>
                <td class="symbol-cell ${symbolClass}">${transaction.tradeSymbol}</td>
                <td>${transaction.tradeMarket || '--'}</td>
                <td>${transaction.positionSize.toFixed(2)}</td>
                <td>${transaction.entryPrice.toFixed(2)}</td>
                <td>${transaction.initialStop.toFixed(2)}</td>
                <td>${transaction.initialTarget.toFixed(2)}</td>
                <td>${transaction.exitPrice ? transaction.exitPrice.toFixed(2) : '--'}</td>
                <td class="${profitClass}">
                    ${profitLoss !== 0 ? '¥' + profitLoss.toFixed(2) : '--'}
                    ${riskPercentText}
                </td>
                <td>
                    <button class="action-btn edit-btn" data-id="${transaction.id}">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="action-btn view-detail-btn" data-id="${transaction.id}">
                        <i class="fas fa-eye"></i> 查看
                    </button>
                    <button class="action-btn delete-btn" data-id="${transaction.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // 为查看按钮添加事件监听器
        document.querySelectorAll('.view-detail-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                this.showTransactionDetail(id);
            });
        });
        
        // 为编辑按钮添加事件监听器（回填表单进入编辑态）
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                this.editTransaction(id);
            });
        });
        
        // 为删除按钮添加事件监听器
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                if (confirm('确定要删除这条交易记录吗？')) {
                    this.deleteTransaction(id);
                }
            });
        });
        
        // 为行添加点击事件
        document.querySelectorAll('tbody tr[data-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const id = parseInt(row.getAttribute('data-id'));
                    this.showTransactionDetail(id);
                }
            });
        });
    }
    
    // 获取交易品种对应的CSS类
    getSymbolClass(symbol, market) {
        if (market === 'A股') return 'symbol-ashare';
        if (market === '商品期货') return 'symbol-future';
        if (symbol.includes('XAU')) return 'symbol-gold';
        if (['EURUSD', 'GBPUSD', 'USDJPY'].includes(symbol)) return 'symbol-forex';
        if (symbol.includes('US30')) return 'symbol-index';
        if (['BTC', 'ETH'].some(crypto => symbol.includes(crypto))) return 'symbol-crypto';
        if (['AAPL', 'TSLA'].some(stock => symbol.includes(stock))) return 'symbol-stock';
        return '';
    }
    
    // 显示交易详情
    showTransactionDetail(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (!transaction) return;
        
        this.currentDetailId = id;
        
        // 更新详情模态框标题
        document.getElementById('detail-title').textContent = 
            `${transaction.tradeSymbol} - ${transaction.tradeCycle} - ${transaction.tradeDirection === '多' ? '多头' : '空头'}交易`;
        
        // 构建详情内容
        const detailContent = document.getElementById('detail-content');
        
        // 格式化时间
        const formatTime = (timeStr) => {
            if (!timeStr) return '--';
            return timeStr;
        };
        
        // 计算持仓时间
        const calculateDuration = (entryTime, exitTime) => {
            if (!entryTime || !exitTime) return '--';
            
            const entry = new Date(entryTime.replace(' ', 'T'));
            const exit = new Date(exitTime.replace(' ', 'T'));
            const diffMs = exit - entry;
            
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            if (days > 0) {
                return `${days}天${hours}小时`;
            } else {
                return `${hours}小时`;
            }
        };
        
        // 风险百分比颜色类
        const getRiskPercentClass = (percent) => {
            if (percent <= 50) return 'positive';
            if (percent <= 100) return '';
            return 'negative';
        };
        
        // 构建HTML
        detailContent.innerHTML = `
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> 基本信息</h4>
                <div class="detail-row">
                    <div class="detail-label">交易品种：</div>
                    <div class="detail-value symbol-cell ${this.getSymbolClass(transaction.tradeSymbol, transaction.tradeMarket)}">
                        ${transaction.tradeSymbol} ${this.symbolPresets[transaction.tradeSymbol]?.name || ''}
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">交易周期：</div>
                    <div class="detail-value">${transaction.tradeCycle}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">交易类型：</div>
                    <div class="detail-value">${transaction.tradeType}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">交易方向：</div>
                    <div class="detail-value ${transaction.tradeDirection === '多' ? 'direction-long' : 'direction-short'}">
                        ${transaction.tradeDirection === '多' ? '多头' : '空头'}
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">交易市场：</div>
                    <div class="detail-value">${transaction.tradeMarket || '--'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">合约乘数：</div>
                    <div class="detail-value">¥${transaction.standardLotValue?.toFixed(2) || '100.00'} / 点</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">交易背景：</div>
                    <div class="detail-value">${transaction.tradeBackground}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-door-open"></i> 开仓信息</h4>
                <div class="detail-row">
                    <div class="detail-label">开仓时间：</div>
                    <div class="detail-value">${formatTime(transaction.entryTime)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">手数：</div>
                    <div class="detail-value">${transaction.positionSize.toFixed(2)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">每点价值：</div>
                    <div class="detail-value">¥${transaction.perPipValue?.toFixed(2) || '0.00'} / 点</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">开仓价格：</div>
                    <div class="detail-value">${transaction.entryPrice.toFixed(2)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">开仓方式：</div>
                    <div class="detail-value">${transaction.entrySignal}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">开仓理由：</div>
                    <div class="detail-value">${transaction.entryReason}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-shield-alt"></i> 风险管理</h4>
                <div class="detail-row">
                    <div class="detail-label">初始止损：</div>
                    <div class="detail-value">${transaction.initialStop.toFixed(2)} (${transaction.stopPips?.toFixed(2) || '0.00'}点)</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">初始目标：</div>
                    <div class="detail-value">${transaction.initialTarget.toFixed(2)} (${transaction.targetPips?.toFixed(2) || '0.00'}点)</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">初始风险价值：</div>
                    <div class="detail-value">¥${transaction.initialRiskValue?.toFixed(2) || '0.00'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">实际风险：</div>
                    <div class="detail-value">
                        ¥${transaction.actualRisk?.toFixed(2) || '0.00'}
                        <span class="${getRiskPercentClass(transaction.actualRiskPercent || 0)}">
                            (${transaction.actualRiskPercent?.toFixed(1) || '0'}% 的初始风险)
                        </span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">风险点数：</div>
                    <div class="detail-value">${transaction.riskPips?.toFixed(4) || '0.0000'}点</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">风险回报比：</div>
                    <div class="detail-value">${transaction.riskReward || '--'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-door-closed"></i> 平仓信息</h4>
                <div class="detail-row">
                    <div class="detail-label">平仓时间：</div>
                    <div class="detail-value">${formatTime(transaction.exitTime)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">持仓时间：</div>
                    <div class="detail-value">${calculateDuration(transaction.entryTime, transaction.exitTime)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">平仓价格：</div>
                    <div class="detail-value">${transaction.exitPrice ? transaction.exitPrice.toFixed(2) : '--'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">实际盈亏：</div>
                    <div class="detail-value ${transaction.actualProfitLoss >= 0 ? 'profit' : 'loss'}">
                        ${transaction.actualProfitLoss ? '¥' + transaction.actualProfitLoss.toFixed(2) : '--'}
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">手续费/税费：</div>
                    <div class="detail-value">¥${transaction.fee?.toFixed(2) || '0.00'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">实际风险回报比：</div>
                    <div class="detail-value">${transaction.actualRiskReward || '--'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">平仓理由：</div>
                    <div class="detail-value">${transaction.exitReason || '--'}</div>
                </div>
            </div>
            
            ${transaction.screenshot ? `
            <div class="detail-section">
                <h4><i class="fas fa-image"></i> 交易截图</h4>
                <img src="${transaction.screenshot.previewUrl}" 
                     alt="交易截图" 
                     class="screenshot-preview"
                     onclick="this.classList.toggle('fullscreen')">
                <p class="screenshot-info">${transaction.screenshot.fileName} (${(transaction.screenshot.fileSize / 1024).toFixed(2)} KB)</p>
            </div>
            ` : ''}
            
            ${transaction.notes ? `
            <div class="detail-section">
                <h4><i class="fas fa-sticky-note"></i> 备注</h4>
                <div class="detail-value">${transaction.notes}</div>
            </div>
            ` : ''}
            
            <div class="risk-explanation">
                <p><i class="fas fa-info-circle"></i> 
                实际风险说明：持仓过程中遇到的最大风险（例如：移动止损后、提前减仓等情况），通常小于等于初始风险。
                初始风险是基于止损价计算的潜在最大损失。</p>
            </div>
        `;
        
        // 显示详情模态框
        document.getElementById('detail-modal').style.display = 'flex';
        
        // 添加图片全屏功能
        const screenshotImg = detailContent.querySelector('.screenshot-preview');
        if (screenshotImg) {
            screenshotImg.addEventListener('click', function() {
                this.classList.toggle('fullscreen');
            });
        }
    }
    
    // 隐藏详情模态框
    hideDetailModal() {
        document.getElementById('detail-modal').style.display = 'none';
        this.currentDetailId = null;
    }
    
    // 更新统计信息
    updateStats() {
        const totalCount = this.transactions.length;
        document.getElementById('total-count').textContent = totalCount;
        
        // 计算胜率和总盈亏
        let winCount = 0;
        let totalProfitLoss = 0;
        let totalRiskReward = 0;
        let closedTrades = 0;
        
        // 计算实际风险控制统计
        let lowRiskTrades = 0; // 实际风险 <= 50% 初始风险
        let moderateRiskTrades = 0; // 50% < 实际风险 <= 100% 初始风险
        let highRiskTrades = 0; // 实际风险 > 100% 初始风险
        
        this.transactions.forEach(t => {
            if (t.exitPrice) {
                closedTrades++;
                if (t.actualProfitLoss > 0) winCount++;
                totalProfitLoss += t.actualProfitLoss;
                
                // 计算平均风险回报比
                if (t.actualRiskReward) {
                    const ratioMatch = t.actualRiskReward.match(/[-]?1:([\d.]+)/);
                    if (ratioMatch) {
                        totalRiskReward += parseFloat(ratioMatch[1]);
                    }
                }
                
                // 统计实际风险控制
                if (t.actualRiskPercent) {
                    if (t.actualRiskPercent <= 50) {
                        lowRiskTrades++;
                    } else if (t.actualRiskPercent <= 100) {
                        moderateRiskTrades++;
                    } else {
                        highRiskTrades++;
                    }
                }
            }
        });
        
        // 更新胜率
        const winRate = closedTrades > 0 ? ((winCount / closedTrades) * 100).toFixed(1) : 0;
        document.getElementById('win-rate').textContent = `${winRate}%`;
        
        // 更新总盈亏
        const totalPlElement = document.getElementById('total-pl');
        totalPlElement.textContent = `¥${totalProfitLoss.toFixed(2)}`;
        totalPlElement.className = totalProfitLoss >= 0 ? 'stat-value positive' : 'stat-value negative';
        
        // 更新平均风险回报比
        const avgR = closedTrades > 0 ? (totalRiskReward / closedTrades).toFixed(2) : 0;
        document.getElementById('avg-r').textContent = avgR;
        
        // 可以添加实际风险控制统计显示
        if (closedTrades > 0) {
            const riskStats = document.createElement('div');
            riskStats.className = 'risk-stats-summary';
            riskStats.innerHTML = `
                <div class="risk-stat-item">
                    <span class="risk-stat-label">低风险交易:</span>
                    <span class="risk-stat-value">${lowRiskTrades} (${((lowRiskTrades/closedTrades)*100).toFixed(1)}%)</span>
                </div>
                <div class="risk-stat-item">
                    <span class="risk-stat-label">中等风险:</span>
                    <span class="risk-stat-value">${moderateRiskTrades} (${((moderateRiskTrades/closedTrades)*100).toFixed(1)}%)</span>
                </div>
                <div class="risk-stat-item">
                    <span class="risk-stat-label">高风险:</span>
                    <span class="risk-stat-value">${highRiskTrades} (${((highRiskTrades/closedTrades)*100).toFixed(1)}%)</span>
                </div>
            `;
            
            // 添加到统计区域（如果需要）
            // document.querySelector('.stats-summary').appendChild(riskStats);
        }
    }
    
    // 导出数据为JSON文件
    exportData() {
        this.downloadTransactionsJSON(true);
    }

    // 自动备份 / 备份提醒相关 ----------
    getLastBackup() {
        const v = localStorage.getItem('professionalTradingLastBackup');
        return v ? parseInt(v, 10) : null;
    }

    setLastBackup(ts = Date.now()) {
        localStorage.setItem('professionalTradingLastBackup', String(ts));
    }

    isAutoBackupEnabled() {
        return localStorage.getItem('professionalTradingAutoBackup') === '1';
    }

    setAutoBackup(enabled) {
        localStorage.setItem('professionalTradingAutoBackup', enabled ? '1' : '0');
    }

    daysSinceBackup() {
        const last = this.getLastBackup();
        if (!last) return Infinity;
        return Math.floor((Date.now() - last) / (24 * 3600 * 1000));
    }

    // 生成导出数据对象
    buildExportData() {
        return {
            exportDate: new Date().toISOString(),
            transactionCount: this.transactions.length,
            transactions: this.transactions
        };
    }

    // 下载 JSON 备份（showMessage=true 时弹出提示并更新提醒状态）
    downloadTransactionsJSON(showMessage) {
        if (this.transactions.length === 0) {
            if (showMessage) this.showMessage('没有交易记录可导出。', 'info');
            return;
        }
        const dataStr = JSON.stringify(this.buildExportData(), null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        const now = new Date();
        const p = n => String(n).padStart(2, '0');
        const ts = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
        link.download = `trading-backup_${ts}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.setLastBackup(Date.now());
        this.checkBackupReminder();
        if (showMessage) this.showMessage('数据备份成功！', 'success');
    }

    // 检查并展示备份提醒横幅
    checkBackupReminder() {
        const banner = document.getElementById('backup-reminder');
        if (!banner) return;
        const days = this.daysSinceBackup();
        let text;
        if (days === Infinity) {
            text = '⚠️ 数据仅保存在当前浏览器，建议点「立即备份」导出 JSON，避免清缓存后丢失。';
        } else if (days >= this.BACKUP_REMIND_DAYS) {
            text = `距上次备份已 ${days} 天，建议再下载一份 JSON 备份。`;
        } else {
            banner.style.display = 'none';
            return;
        }
        const textEl = document.getElementById('backup-reminder-text');
        if (textEl) textEl.textContent = text;
        banner.style.display = 'flex';
    }

    // 导出 Markdown 形式的交易记录
    exportMarkdown() {
        if (this.transactions.length === 0) {
            this.showMessage('没有交易记录可导出。', 'info');
            return;
        }

        const pad = (n) => String(n).padStart(2, '0');
        const ldt = (d) => {
            const dt = new Date(d);
            if (isNaN(dt)) return '--';
            return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        };
        const num = (v, d = 2) => (v === null || v === undefined || isNaN(v)) ? '--' : Number(v).toFixed(d);
        const signed = (v) => {
            if (v === null || v === undefined || isNaN(v)) return '--';
            const n = Number(v);
            return (n >= 0 ? '+' : '-') + '¥' + Math.abs(n).toFixed(2);
        };
        const dirText = (d) => (d === '多' ? '多' : d === '空' ? '空' : '--');
        const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '／');

        const txs = this.transactions;
        const closed = txs.filter(t => t.exitPrice);
        const wins = closed.filter(t => t.actualProfitLoss > 0);
        const losses = closed.filter(t => t.actualProfitLoss < 0);
        const winRate = closed.length ? (wins.length / closed.length * 100) : 0;
        const totalPL = closed.reduce((s, t) => s + (Number(t.actualProfitLoss) || 0), 0);
        const realizedRs = closed
            .filter(t => t.initialRiskValue > 0)
            .map(t => Math.abs((Number(t.actualProfitLoss) || 0) / t.initialRiskValue));
        const avgR = realizedRs.length
            ? realizedRs.reduce((s, r) => s + r, 0) / realizedRs.length
            : 0;
        const withScreenshot = txs.filter(t => t.screenshot && t.screenshot.previewUrl).length;

        // 文件头
        let md = '';
        md += `# 交易记录导出\n\n`;
        md += `> 导出时间：${ldt(new Date())} · 共 ${txs.length} 笔记录`;
        if (withScreenshot) md += ` · 含截图 ${withScreenshot} 张`;
        md += `\n\n`;

        // 一、总体概览
        md += `## 一、总体概览\n\n`;
        md += `| 指标 | 数值 |\n`;
        md += `| --- | --- |\n`;
        md += `| 交易总笔数 | ${txs.length} |\n`;
        md += `| 已平仓笔数 | ${closed.length} |\n`;
        md += `| 盈利 / 亏损 | ${wins.length} / ${losses.length} |\n`;
        md += `| 胜率 | ${num(winRate, 1)}% |\n`;
        md += `| 总盈亏 | ${signed(totalPL)} |\n`;
        md += `| 平均实际 R 比 | ${closed.length ? num(avgR, 2) : '--'} |\n\n`;

        // 二、交易明细表
        md += `## 二、交易明细\n\n`;
        md += `| # | 日期 | 市场 | 品种 | 方向 | 手数 | 开仓价 | 平仓价 | 手续费 | 盈亏 | 实际R |\n`;
        md += `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
        txs.forEach((t, i) => {
            const r = (t.initialRiskValue > 0 && t.actualProfitLoss)
                ? num(Math.abs(t.actualProfitLoss / t.initialRiskValue), 2)
                : '--';
            md += `| ${i + 1} `
                + `| ${cell(t.entryTime ? ldt(t.entryTime) : '--')} `
                + `| ${cell(t.tradeMarket || '--')} `
                + `| ${cell(t.tradeSymbol || '--')} `
                + `| ${dirText(t.tradeDirection)} `
                + `| ${num(t.positionSize)} `
                + `| ${num(t.entryPrice)} `
                + `| ${t.exitPrice ? num(t.exitPrice) : '--'} `
                + `| ${num(t.fee)} `
                + `| ${signed(t.actualProfitLoss)} `
                + `| ${r} |\n`;
        });
        md += `\n`;

        // 三、逐笔详情
        md += `## 三、逐笔详情\n\n`;
        txs.forEach((t, i) => {
            const status = t.exitPrice ? '已平仓' : '持仓中';
            md += `### ${i + 1}. ${cell(t.tradeSymbol)}（${cell(t.tradeMarket)} · ${dirText(t.tradeDirection)}） ${status}\n\n`;
            md += `- **交易周期**：${cell(t.tradeCycle || '--')}　**交易类型**：${cell(t.tradeType || '--')}\n`;
            md += `- **开仓时间**：${cell(t.entryTime ? ldt(t.entryTime) : '--')}　**平仓时间**：${t.exitTime ? cell(ldt(t.exitTime)) : '--'}\n`;
            md += `- **手数**：${num(t.positionSize)}　**合约乘数**：${num(t.standardLotValue, 0)}　**每点价值**：¥${num(t.perPipValue)}\n`;
            md += `- **开仓价**：${num(t.entryPrice)}　**初始止损**：${num(t.initialStop)}（${num(t.stopPips)}点）\n`;
            md += `- **初始目标**：${num(t.initialTarget)}（${num(t.targetPips)}点）　**计划 R 比**：${cell(t.riskReward || '--')}\n`;
            md += `- **平仓价**：${t.exitPrice ? num(t.exitPrice) : '--'}　**平仓理由**：${cell(t.exitReason || '--')}\n`;
            md += `- **手续费/税费**：¥${num(t.fee)}　**实际盈亏**：${signed(t.actualProfitLoss)}　**实际 R 比**：${cell(t.actualRiskReward || '--')}\n`;
            if (t.tradeBackground) md += `- **交易背景**：${cell(t.tradeBackground)}\n`;
            if (t.entrySignal) md += `- **入场信号**：${cell(t.entrySignal)}\n`;
            if (t.entryReason) md += `- **入场理由**：${cell(t.entryReason)}\n`;
            if (t.notes) md += `- **备注**：${cell(t.notes)}\n`;
            if (t.screenshot && t.screenshot.previewUrl) md += `- **截图**：📎 ${cell(t.screenshot.fileName || '已附截图')}\n`;
            md += `\n`;
        });

        // 触发下载
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `交易记录_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showMessage('Markdown 导出成功！', 'success');
    }

    // 显示导入模态框
    showImportModal() {
        document.getElementById('import-modal').style.display = 'flex';
        document.getElementById('import-file').value = '';
    }
    
    // 隐藏导入模态框
    hideImportModal() {
        document.getElementById('import-modal').style.display = 'none';
    }
    
    // 导入数据
    importData() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showMessage('请选择要导入的文件。', 'warning');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // 验证数据格式
                if (!importedData.transactions || !Array.isArray(importedData.transactions)) {
                    throw new Error('文件格式不正确');
                }
                
                // 确认是否合并导入（按 id 去重，相同 id 取较新的一条）
                if (this.transactions.length > 0 &&
                    !confirm('导入将与现有记录按 id 合并（相同 id 取较新的一条），确定继续吗？')) {
                    return;
                }

                // 增量合并：以 id 为主键；相同 id 用较新的 updatedAt/createdAt 覆盖，否则新增
                const existingMap = new Map(this.transactions.map(t => [t.id, t]));
                let added = 0, updated = 0;
                for (const t of importedData.transactions) {
                    if (t.id == null) t.id = Date.now() + Math.floor(Math.random() * 1000);
                    const ex = existingMap.get(t.id);
                    if (ex) {
                        const exTime = new Date(ex.updatedAt || ex.createdAt || 0).getTime();
                        const inTime = new Date(t.updatedAt || t.createdAt || 0).getTime();
                        if (inTime > exTime) {
                            const idx = this.transactions.findIndex(x => x.id === t.id);
                            this.transactions[idx] = t;
                            updated++;
                        }
                    } else {
                        this.transactions.push(t);
                        existingMap.set(t.id, t);
                        added++;
                    }
                }
                this.saveTransactions();


                this.renderTransactions();
                this.updateStats();

                // 更新图表
                this.renderCharts();

                // 关闭模态框
                this.hideImportModal();

                // 显示消息
                this.showMessage(`成功合并导入：新增 ${added} 条，更新 ${updated} 条。`, 'success');
                
            } catch (error) {
                console.error('导入失败:', error);
                this.showMessage('导入失败：文件格式不正确或已损坏。', 'error');
            }
        };
        
        reader.onerror = () => {
            this.showMessage('读取文件时发生错误。', 'error');
        };
        
        reader.readAsText(file);
    }
    
    // 显示消息
    showMessage(message, type) {
        // 移除现有消息
        const existingMessage = document.querySelector('.message-toast');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message-toast message-${type}`;
        messageEl.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                          type === 'error' ? 'fa-exclamation-circle' : 
                          type === 'warning' ? 'fa-exclamation-triangle' : 
                          'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // 添加样式
        messageEl.style.cssText = `
            position: fixed;
            top: 30px;
            right: 30px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        `;
        
        // 根据类型设置背景色
        const colors = {
            success: 'linear-gradient(135deg, #10b981, #059669)',
            error: 'linear-gradient(135deg, #ef4444, #dc2626)',
            warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
            info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
        };
        
        messageEl.style.background = colors[type] || colors.info;
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
        
        // 添加CSS动画
        if (!document.querySelector('#message-animations')) {
            const style = document.createElement('style');
            style.id = 'message-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new ProfessionalTradingTracker();
});

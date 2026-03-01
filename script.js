document.addEventListener('DOMContentLoaded', () => {
    // === タブ切り替えのロジック ===
    const tabInfusion = document.getElementById('tab-infusion');
    const tabUrine = document.getElementById('tab-urine');
    const tabCombined = document.getElementById('tab-combined');
    const formInfusionContainer = document.getElementById('form-infusion');
    const formUrineContainer = document.getElementById('form-urine');
    const formCombinedContainer = document.getElementById('form-combined');
    const resultContainer = document.getElementById('result-container');
    const noteText = document.getElementById('note-text');

    // 現在どのモードで計算しているかを保持する変数
    let currentMode = 'urine';

    function switchTab(mode, activeTab, activeForm, noteMessage) {
        currentMode = mode;

        // 全タブ・フォームを一旦非表示
        [tabInfusion, tabUrine, tabCombined].forEach(t => t.classList.remove('active'));
        [formInfusionContainer, formUrineContainer, formCombinedContainer].forEach(f => f.classList.remove('active'));

        // 選択されたものを表示
        activeTab.classList.add('active');
        activeForm.classList.add('active');

        resultContainer.classList.add('hidden');
        noteText.textContent = noteMessage;
    }

    tabInfusion.addEventListener('click', () => {
        switchTab('infusion', tabInfusion, formInfusionContainer, '実際の臨床では尿量などの影響も考慮してください。');
    });

    tabUrine.addEventListener('click', () => {
        switchTab('urine', tabUrine, formUrineContainer, '尿中電解質濃度や尿量が24時間一定であることを仮定した簡易予測です。');
    });

    tabCombined.addEventListener('click', () => {
        switchTab('combined', tabCombined, formCombinedContainer, '輸液と尿排泄の両方を考慮した予測です。指定した尿量と輸液量に基づき計算します。');
    });

    // === 輸液プリセットのロジック ===
    const handlePreset = (presetEl, naInput, kInput) => {
        const selectedValue = presetEl.value;
        if (selectedValue !== 'custom') {
            const values = selectedValue.split(',');
            naInput.value = values[0];
            kInput.value = values[1];
        }
    };

    const infusionPreset = document.getElementById('infusion-preset');
    const infusateNaInput = document.getElementById('infusate-na');
    const infusateKInput = document.getElementById('infusate-k');

    infusionPreset.addEventListener('change', () => handlePreset(infusionPreset, infusateNaInput, infusateKInput));

    // 複合モード用のプリセット
    const cInfusionPreset = document.getElementById('c-infusion-preset');
    const cInfusateNaInput = document.getElementById('c-infusate-na');
    const cInfusateKInput = document.getElementById('c-infusate-k');

    cInfusionPreset.addEventListener('change', () => handlePreset(cInfusionPreset, cInfusateNaInput, cInfusateKInput));

    // === 計算処理のロジック ===
    const formInfusion = document.getElementById('calculator-form-infusion');
    const formUrine = document.getElementById('calculator-form-urine');
    const formCombined = document.getElementById('calculator-form-combined');
    const resultFinalNa = document.getElementById('result-final-na');
    const resultDeltaNa = document.getElementById('result-delta-na');

    // 輸液のみ考慮モードの計算
    formInfusion.addEventListener('submit', (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('weight').value);
        const waterRatio = parseFloat(document.getElementById('water-ratio').value) / 100;
        const volume = parseFloat(document.getElementById('volume').value);
        const currentNa = parseFloat(document.getElementById('current-na').value);
        const infusateNa = parseFloat(document.getElementById('infusate-na').value);
        const infusateK = parseFloat(document.getElementById('infusate-k').value);

        const tbw = weight * waterRatio;
        const totalEffectiveOsmolesPre = currentNa * tbw;
        const addedEffectiveOsmoles = (infusateNa + infusateK) * volume;
        const finalTBW = tbw + volume;

        const finalNa = (totalEffectiveOsmolesPre + addedEffectiveOsmoles) / finalTBW;
        const deltaNa = finalNa - currentNa;

        displayResults(finalNa, deltaNa);
    });

    // 尿排泄のみ考慮モードの計算 (24h)
    formUrine.addEventListener('submit', (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('u-weight').value);
        const waterRatio = parseFloat(document.getElementById('u-water-ratio').value) / 100;
        const currentNa = parseFloat(document.getElementById('u-current-na').value);
        const urineVolHr = parseFloat(document.getElementById('u-urine-vol-hr').value);
        const urineNa = parseFloat(document.getElementById('u-urine-na').value);
        const urineK = parseFloat(document.getElementById('u-urine-k').value);

        const tbw = weight * waterRatio;
        const urineVol24hLiters = (urineVolHr * 24) / 1000;
        const deltaNa = (urineVol24hLiters * (currentNa - (urineNa + urineK))) / (tbw - urineVol24hLiters);
        const finalNa = currentNa + deltaNa;

        displayResults(finalNa, deltaNa);
    });

    // 輸液＋尿排泄 考慮モードの計算
    formCombined.addEventListener('submit', (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('c-weight').value);
        const waterRatio = parseFloat(document.getElementById('c-water-ratio').value) / 100;
        const currentNa = parseFloat(document.getElementById('c-current-na').value);

        // 尿に関する値
        const urineVolML = parseFloat(document.getElementById('c-urine-vol').value);
        const urineVolLiters = urineVolML / 1000; // Vu (Lに変換)
        const urineNa = parseFloat(document.getElementById('c-urine-na').value);
        const urineK = parseFloat(document.getElementById('c-urine-k').value);

        // 輸液に関する値
        const infusionVolume = parseFloat(document.getElementById('c-volume').value); // Vin
        const infusateNa = parseFloat(document.getElementById('c-infusate-na').value); // Na_in
        const infusateK = parseFloat(document.getElementById('c-infusate-k').value); // K_in

        // 1. 体液量 (TBW)
        const tbw = weight * waterRatio;

        // 2. 複合公式: Na_after = (Na_before*TBW + (Na_in+K_in)*V_in - (Na_u+K_u)*V_u) / (TBW + V_in - V_u)
        const currentOsmoles = currentNa * tbw;
        const inOsmoles = (infusateNa + infusateK) * infusionVolume;
        const outOsmoles = (urineNa + urineK) * urineVolLiters;

        const finalTBW = tbw + infusionVolume - urineVolLiters;

        const finalNa = (currentOsmoles + inOsmoles - outOsmoles) / finalTBW;
        const deltaNa = finalNa - currentNa;

        displayResults(finalNa, deltaNa);
    });

    // === 結果表示用の関数 ===
    function displayResults(finalNa, deltaNa) {
        resultFinalNa.textContent = finalNa.toFixed(1);

        if (deltaNa > 0) {
            resultDeltaNa.textContent = '+' + deltaNa.toFixed(1);
        } else {
            resultDeltaNa.textContent = deltaNa.toFixed(1);
        }

        resultContainer.classList.remove('hidden');
    }
});

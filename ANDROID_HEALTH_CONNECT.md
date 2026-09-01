# FitTrack — Integração Android com Health Connect

Este guia descreve a camada nativa necessária para sincronizar dados de uma Mi Band no Android.

## Fluxo esperado

```text
Mi Band > Mi Fitness ou Zepp Life > Health Connect > FitTrack Android > FitTrack WebView/PWA
```

O FitTrack web já possui uma ponte JavaScript pronta para receber os dados:

```js
window.FitTrackHealthConnect.importDailySummary({
  date: '2026-09-01',
  steps: 8500,
  activeCalories: 420,
  totalCalories: 1900,
  sleepHours: 7.6,
  avgHeartRate: 78,
  maxHeartRate: 156,
  workouts: 1,
  workoutMinutes: 52,
  source: 'Mi Band / Health Connect'
});
```

Também é possível importar vários dias:

```js
window.FitTrackHealthConnect.importDailySummaries([
  { date: '2026-09-01', steps: 8500, activeCalories: 420 },
  { date: '2026-09-02', steps: 9200, activeCalories: 460 }
]);
```

## Dados recomendados

Ler do Health Connect:

- `StepsRecord`
- `ActiveCaloriesBurnedRecord`
- `TotalCaloriesBurnedRecord`
- `HeartRateRecord`
- `SleepSessionRecord`
- `ExerciseSessionRecord`

Para dados acumulados, como passos e calorias, prefira agregação por período para reduzir duplicidade entre fontes.

## Permissões Android

Declarar no `AndroidManifest.xml` as permissões do Health Connect que forem usadas:

```xml
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_TOTAL_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
```

O app também precisa solicitar essas permissões em tempo de execução antes da leitura.

## Contrato do JavaScript Bridge

A camada Android deve expor um método chamado `syncDailySummary(date)` para a WebView.

Esse método deve retornar JSON em string:

```json
{
  "date": "2026-09-01",
  "steps": 8500,
  "activeCalories": 420,
  "totalCalories": 1900,
  "sleepHours": 7.6,
  "avgHeartRate": 78,
  "maxHeartRate": 156,
  "workouts": 1,
  "workoutMinutes": 52,
  "source": "Mi Band / Health Connect"
}
```

No Android, registre a ponte na WebView com o nome `AndroidHealthConnect`.

Exemplo conceitual:

```kotlin
webView.addJavascriptInterface(
    AndroidHealthConnectBridge(context, healthConnectManager),
    "AndroidHealthConnect"
)
```

## Responsabilidade da camada Android

A camada nativa deve:

1. Verificar se o Health Connect está disponível.
2. Pedir permissões ao usuário.
3. Ler dados do dia selecionado.
4. Agregar passos e calorias.
5. Calcular sono em horas.
6. Calcular batimento médio e máximo.
7. Contar sessões de exercício.
8. Retornar o JSON para o FitTrack.

## Observação importante

O PWA no navegador não consegue ler Health Connect diretamente. A leitura automática exige app Android nativo ou híbrido, por exemplo com Capacitor ou WebView Android.

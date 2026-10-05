// Mock 数据：内置真实 Hamoa/Qualcomm 平台案例

const categories = [
  { _id: 'boot',     name: '启动流程',   nameEn: 'Boot',     icon: '🚀', color: '#FF6B6B', order: 1, desc: 'start_kernel / DT / deferred probe / pstore' },
  { _id: 'mm',       name: '内存管理',   nameEn: 'MM',       icon: '💾', color: '#4ECDC4', order: 2, desc: 'buddy / slab / pKVM / SMMU / FFA' },
  { _id: 'pm',       name: '电源管理',   nameEn: 'PM',       icon: '⚡', color: '#45B7D1', order: 3, desc: 'suspend / CPUIdle / LPM / RPMh / S2idle' },
  { _id: 'irq',      name: '中断子系统', nameEn: 'IRQ',      icon: '🔔', color: '#96CEB4', order: 4, desc: 'GICv3 / MSI / IRQ affinity / wakeup' },
  { _id: 'drivers',  name: '设备驱动',   nameEn: 'Drivers',  icon: '🔧', color: '#FFEAA7', order: 5, desc: 'NVMe / PCIe / WLAN / Remoteproc / WDT' },
  { _id: 'debug',    name: '调试技术',   nameEn: 'Debug',    icon: '🐛', color: '#C3B1E1', order: 6, desc: 'ramdump / crash / JTAG / ftrace / ramoops' },
  { _id: 'build',    name: '构建系统',   nameEn: 'Build',    icon: '🏗️', color: '#98D8C8', order: 7, desc: 'Kleaf / Bazel / GKI / DLKM / defconfig' },
  { _id: 'security', name: '安全子系统', nameEn: 'Security', icon: '🔒', color: '#F7DC6F', order: 8, desc: 'SELinux / pKVM / TZ / SecureBoot' },
]

const knowledge = [
  // ─────────────────────────────────────────────
  // PM — Watchdog
  // ─────────────────────────────────────────────
  {
    _id: 'pm_wdt',
    categoryId: 'pm',
    title: 'QCOM Watchdog：pet / bark / bite 三级机制',
    summary: 'Qualcomm WDT 通过三个时间阈值保障系统健康，bark 触发 NMI，bite 强制复位',
    tags: ['WDT', 'Hamoa', 'PM', 'NMI'],
    difficulty: 2,
    concept: `Qualcomm WDT 三级时间参数：
• pet_time  = 9360ms  ← kthread 喂狗周期
• bark_time = 11000ms ← 超时触发 NMI（软件有机会 dump）
• bite_time = 14000ms ← 强制 reset（不可阻止）
安全窗口：bark - pet = 1640ms`,
    principle: `代码路径（qcom_wdt_core.c）：
1. qcom_wdt_start() 初始化寄存器
2. kthread pet_task 每隔 pet_time 写 WDOG_RESET 寄存器
3. bark 触发 → NMI handler → dump regs / dmesg
4. bite 触发 → 硬件强制 SoC reset

寄存器映射（qcom_soc_wdt.c）：
WDOG_RESET  = base + 0x04  // 喂狗写 1
WDOG_BARK   = base + 0x10  // bark 阈值（ticks）
WDOG_BITE   = base + 0x14  // bite 阈值`,
    case: `Hamoa MMWR 问题（Gerrit #7167726）：
Google 要求区分两种 reset 路径：
• SW crash (NULL ptr / Oops) → Warm Reset (MMWR)，不走 SDI
• HW WDT bark/bite / ADSP SSR → SDI path

原因：SW crash 时走 WDT bite 会触发 SDI（minidump），
Google 希望 SW crash 用 warm reset 跳过 SDI，提高重启速度。

Fix: 在 die() handler 里 disable WDT bite，直接 machine_restart()`,
    interviews: [
      {
        level: 'basic',
        question: 'Linux 看门狗的作用是什么？bark 和 bite 有什么区别？',
        answer: `看门狗（Watchdog）监控系统健康：软件必须定期"喂狗"（写寄存器），
否则触发 reset。

bark：超时的第一阶段，触发 NMI/中断，系统还在运行，
      可以 dump 调用栈、打印寄存器，用于诊断。
bite：超时的第二阶段（更长），硬件强制 reset SoC，
      不依赖软件，即使 CPU 完全卡死也能恢复。`,
      },
      {
        level: 'advanced',
        question: 'QCOM WDT 的 kthread 喂狗机制如何保证及时性？如果系统负载很高会怎样？',
        answer: `pet_task 是 RT kthread（SCHED_FIFO），优先级高于普通任务，
保证在 bark_time 到来前能被调度执行。

高负载场景：
• pet_task 是 RT，普通任务无法饿死它
• 但若 RT 任务也把 CPU 占满（如 RT throttle 触发），
  pet_task 仍可能延迟 → bark

监控手段：/sys/kernel/debug/qcom_wdt/ 下有 pet_delay 统计`,
      },
      {
        level: 'expert',
        question: 'MMWR 方案中，如何在 die() 路径里安全地 disable WDT bite 并触发 warm reset？需要考虑哪些竞争条件？',
        answer: `MMWR 实现要点（qcom_wdt_core.c 扩展）：
1. 在 die() handler（arch/arm64/kernel/traps.c）注册 vendor hook
2. hook 里：disable WDT bite（写 WDOG_BITE 寄存器为 0）
3. 调用 qcom_restart(RESTART_WARM) 触发 warm reset

竞争条件：
• 多 CPU 同时 panic：用 atomic 保证只执行一次 disable
• bark IRQ 已在飞行中：bark handler 里判断 MMWR flag，若设置则跳过 SDI
• restart handler 必须在 bark timeout 前完成，否则 bite 仍会触发

关键：disable WDT bite 必须在 machine_restart 之前，
      且 machine_restart 本身要在 bite_time 窗口内完成。`,
      },
    ],
    codeRefs: [
      'soc-repo/drivers/soc/qcom/qcom_wdt_core.c',
      'soc-repo/drivers/soc/qcom/qcom_soc_wdt.c',
      'common/arch/arm64/kernel/traps.c: die()',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },

  // ─────────────────────────────────────────────
  // PM — S2idle
  // ─────────────────────────────────────────────
  {
    _id: 'pm_s2idle',
    categoryId: 'pm',
    title: 'S2idle：suspend-to-idle 完整流程',
    summary: '轻量级挂起，CPU 进 idle 但不断电，比 S3 快，是 Qualcomm 桌面平台主流低功耗模式',
    tags: ['S2idle', 'PM', 'suspend', 'Hamoa', 'AOP'],
    difficulty: 2,
    concept: `S2idle（freeze/S0ix）：
• CPU 进入最深 idle 状态（C-state），设备 runtime suspend
• DRAM 保持上电（与 S3 不同，S3 断 DRAM 电需要完整 resume）
• 唤醒延迟 <100ms，S3 通常 >500ms
• Qualcomm 桌面平台（Hamoa）默认使用 S2idle`,
    principle: `入口流程（kernel/power/suspend.c）：
echo freeze > /sys/power/state
 → pm_suspend(PM_SUSPEND_TO_IDLE)
 → freeze_processes()           // 冻结用户态
 → suspend_devices_and_enter()
   → dpm_suspend_start()        // 设备 suspend
   → cpuidle_play_dead()        // CPU 进最深 idle
   → [硬件 wakeup 事件]
   → dpm_resume_end()           // 设备 resume
 → thaw_processes()

QCOM 平台：AOP（Always On Processor）
在 S2idle 期间管理电源域，AP 睡眠时 AOP 仍运行`,
    case: `Hamoa S2idle 唤醒源分析：
[936.486646] msm_show_resume_irqs: HWIRQ 261

HWIRQ 261 = timerfd 产生的 timer 唤醒
调试方法：
1. /proc/interrupts 查 IRQ 261 对应的设备
2. echo 1 > /sys/module/msm_show_resume_irq/parameters/debug_mask
3. Gerrit #7285729 在 ipcc mailbox 添加 s2idle debug logging`,
    interviews: [
      {
        level: 'basic',
        question: 'S2idle 和 S3 suspend 的主要区别是什么？',
        answer: `S2idle（suspend-to-idle / freeze）：
• CPU 进深度 idle，DRAM 保持上电
• 唤醒快（<100ms），适合频繁 suspend/resume
• 纯软件实现，不需要 SoC 特殊支持

S3（suspend-to-RAM）：
• CPU 断电，DRAM 自刷新保持数据
• 功耗更低，但唤醒慢（>500ms）
• 需要 PSCI SYSTEM_SUSPEND 支持

Qualcomm 桌面平台用 S2idle，因为用户体验要求唤醒快`,
      },
      {
        level: 'advanced',
        question: '如何定位 S2idle 唤醒后的唤醒源？有哪些调试手段？',
        answer: `方法 1：msm_show_resume_irqs
  dmesg 里搜 "msm_show_resume_irqs: HWIRQ xxx"
  → 拿到 HWIRQ 号 → /proc/interrupts 对应设备名

方法 2：wakeup sources 统计
  cat /sys/kernel/debug/wakeup_sources
  → 查 active_count / event_count

方法 3：pm_debug
  echo 1 > /sys/module/pm_debug/parameters/enable
  → 打印每个设备 suspend/resume 耗时

方法 4：ftrace
  trace-cmd record -e "power:*" sleep 1
  → 分析 CPU idle 状态转换`,
      },
      {
        level: 'expert',
        question: 'Qualcomm AOP 在 S2idle 中的角色是什么？AP 睡眠后电源域如何管理？',
        answer: `AOP（Always On Processor）是一个小型 MCU，在 AP 睡眠时持续运行：

职责：
1. 管理 CX/MX 等电源域（AP 睡后 AOP 决定是否断电）
2. 处理 PMIC 通信（RPMh 消息）
3. 监控温度传感器
4. 响应外部唤醒事件，在适当时机唤醒 AP

流程：
AP 发送 "sleep set" RPMh 消息 → AOP 收到
 → AOP 确认所有 voter 都 idle
 → 关闭 CX/MX 电源域
 → 外部事件（PMIC/WLAN）→ AOP 重新上电
 → 发送唤醒信号给 GIC → AP resume

调试：cat /sys/kernel/debug/qcom_rpmh/*/curr_state`,
      },
    ],
    codeRefs: [
      'kernel/power/suspend.c: pm_suspend()',
      'soc-repo/drivers/soc/qcom/lpm-levels.c',
      'common/drivers/cpuidle/cpuidle.c',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },

  // ─────────────────────────────────────────────
  // MM — SMMU
  // ─────────────────────────────────────────────
  {
    _id: 'mm_smmu',
    categoryId: 'mm',
    title: 'ARM SMMU：系统级 MMU 架构与 Fault 分析',
    summary: '为 DMA 设备提供地址转换和隔离，防止恶意/错误设备访问不该访问的内存',
    tags: ['SMMU', 'IOMMU', 'DMA', 'Hamoa', 'pKVM'],
    difficulty: 3,
    concept: `SMMU（System MMU）：
• 位于设备和内存总线之间，对设备发出的 DMA 地址做转换
• 每个设备有独立的页表（IOMMU domain），实现设备间内存隔离
• SMMUv2：Qualcomm 平台使用（15000000.iommu、3da0000.iommu）
• SMMUv3：PCIe 设备（ARM 新一代）

与 CPU MMU 对比：
CPU MMU  → 为 CPU 做虚拟地址→物理地址转换
SMMU     → 为 DMA 设备做 IOVA→物理地址转换`,
    principle: `Qualcomm 平台 SMMU 层次：
SMMU 15000000.iommu → ADSP/CDSP/GPU 等外设
SMMU 3da0000.iommu  → DDR 4-channel fused target

Fault 触发路径（arm-smmu.c）：
arm_smmu_global_fault()
 → arm_smmu_context_fault()
   → 打印 FAR（fault address）、FSR（fault status）
   → 调用 report_iommu_fault()

Hamoa boot hang 案例：
"SMMUv2 with:" 后卡住 → 卡在 arm_smmu_gr0_read(GR0_ID0)
原因：DDR 4-channel fused target 上 SMMU 时钟未就绪`,
    case: `ADSPIMAGE-1189085（Hamoa.AL.2.0）：
现象：multimedia stress + SSR 压测时触发：
  arm-smmu 15000000.iommu: Unhandled context fault
  from 6800000.remoteproc-adsp

根因：shutdown-ack DT 修改导致 ADSP SSR 时序变化，
ADSP 在 SMMU context 还未清理时就重新加载，
触发 stale IOVA 映射冲突

Fix：在 SSR shutdown 路径确保 SMMU unmap 先于 ADSP reset`,
    interviews: [
      {
        level: 'basic',
        question: 'IOMMU/SMMU 的作用是什么？为什么需要它？',
        answer: `没有 SMMU：DMA 设备可以读写任意物理内存（安全风险！）
有了 SMMU：
1. 隔离：每个设备只能访问自己 domain 的 IOVA 范围
2. 保护：防止 DMA 攻击（外设被攻击不能读系统内存）
3. 虚拟化：pKVM 用 SMMU Stage-2 隔离 Guest 和 Host 的 DMA 访问`,
      },
      {
        level: 'advanced',
        question: '遇到 "Unhandled context fault" 时如何分析根因？',
        answer: `步骤：
1. 看 FAR（Fault Address Register）：出问题的 IOVA 地址
2. 看 FSYNR（Fault Syndrome）：
   • WNR bit：写错误(1)还是读错误(0)
   • TRANS fault：页表查不到
   • PERM fault：权限不足
3. 对应 DMA mapping：在 iommu domain 里查 IOVA → PA 映射
4. 找调用者：dma_map_single/sg 谁做的 mapping
5. 时序问题：unmap 是否在 DMA 完成前提前调用了`,
      },
      {
        level: 'expert',
        question: 'pKVM 如何利用 SMMU 实现设备直通（Device Assignment）的内存隔离？',
        answer: `pKVM 双层保护模型：
Stage-1（SMMU context bank）：
  Guest OS 控制，IOVA → Guest PA 转换
Stage-2（SMMU secure stream）：
  Hypervisor 控制，Guest PA → Host PA 转换
  Guest 无法修改 Stage-2，确保不能越界访问 Host 内存

Qualcomm 实现（Hamoa pKVM）：
• qtee_ffa_mem_share() 将内存转移给 TZ/Guest
• SMMU Stage-2 由 pKVM 在 EL2 配置
• Bug 案例（CR 4627697）：FFA reclaim 失败时误释放页，
  导致 Hypervisor 保护的页被 buddy allocator 重用`,
      },
    ],
    codeRefs: [
      'common/drivers/iommu/arm/arm-smmu/arm-smmu.c',
      'soc-repo/drivers/iommu/arm-smmu-qcom.c',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },

  // ─────────────────────────────────────────────
  // Debug — Ramdump / Crash
  // ─────────────────────────────────────────────
  {
    _id: 'debug_ramdump',
    categoryId: 'debug',
    title: 'Ramdump 分析：CPU Stack 重建方法论',
    summary: '从 SP 寄存器出发，重建 ARM64 内核调用栈，定位 WDT/panic 根因',
    tags: ['ramdump', 'crash', 'ARM64', 'stack', 'WDT', 'SC8380XP'],
    difficulty: 3,
    concept: `ARM64 内核栈布局：
每个任务有 16KB 内核栈（THREAD_SIZE = 16384）
低地址 → stack overflow 检测 (STACK_MAGIC)
高地址 → 栈底（task_struct 存放处）

SP（Stack Pointer）始终指向当前栈帧顶：
• 函数调用：SP -= N（为被调用函数分配空间）
• 函数返回：SP += N（释放空间）

有了 SP → 读栈内存 → 找 LR（返回地址） → 重建调用链`,
    principle: `crash 工具重建步骤：
1. crash vmlinux vmcore
2. bt <pid>    # 自动重建调用栈（依赖 unwind table）
3. 若 unwind 失败（栈损坏）：
   rd <SP地址> 32   # 读 32 个字，逐个判断是否为内核地址
   sym <地址>       # 判断是否为合法函数地址

手动重建（SC8380XP WDT 案例）：
crash> set <task_addr>
crash> bt -FF
→ 从 saved PC/SP 出发，逐帧 unwind`,
    case: `SC8380XP WDT 案例（Crash ID: 7ee6929d）：
平台: X1P42100，AL_Reboot_B2B_200s 压测
根因: APPS_ERR_FATAL_NON_SECURE_WDT on CPU1
开机约 12s 触发

分析过程：
1. crash> log → 找最后一条 dmesg
2. crash> bt -a → 所有 CPU 调用栈
3. CPU1 栈顶：__schedule() → 找调度异常
4. 对比正常 CPU 和异常 CPU 的 task state
5. 发现 CPU1 上某 RT task 持锁后被 WDT bark 打断`,
    interviews: [
      {
        level: 'basic',
        question: '什么是 ramdump？如何从设备上获取？',
        answer: `ramdump：系统 crash/reset 时保存的内存快照（DRAM 内容）

获取方式（Qualcomm 平台）：
1. WDT bite/panic 触发 SDI（Subsystem Debug Image）
2. SDI 将 DRAM 内容保存到 eMMC 或通过 USB 传出
3. 文件通常在 /data/vendor/ramdump/ 或通过 QPST 工具下载

内容：vmcore（ELF 格式）+ vmlinux（带符号的内核镜像）`,
      },
      {
        level: 'advanced',
        question: '如何用 crash 工具分析一个 NULL pointer dereference？',
        answer: `步骤：
1. crash vmlinux vmcore
2. crash> log | grep "Unable to handle"
   → 找 pc（出问题的指令地址）和 lr（调用者）
3. crash> sym <pc>      → 定位到具体函数+偏移
4. crash> dis -l <func> → 反汇编找具体行
5. crash> bt            → 完整调用栈
6. crash> p <变量>      → 查看出问题时的变量值

关键："pc"是出问题的地址，"lr"是调用它的函数`,
      },
      {
        level: 'expert',
        question: '内核栈损坏时（bt 无法 unwind），如何手动从 SP 重建调用链？',
        answer: `手动重建步骤：

1. 找 SP：从 crash 日志中的寄存器 dump 获取 sp 值
2. 读栈内存：
   crash> rd -64 <sp> 64    # 读 64 个 8字节值
3. 逐个判断是否是内核代码地址：
   crash> sym <addr>        # 如果显示函数名，就是有效 LR
4. 从底向上重建：valid_addr → sym → 函数名+偏移
5. 结合 arch/arm64 frame pointer 约定：
   [sp+0] = x29（frame pointer of caller）
   [sp+8] = x30（return address = LR）

注意：CONFIG_FRAME_POINTER=y 时 x29 链成链表，
可以沿 x29 逐帧 unwind`,
      },
    ],
    codeRefs: [
      'common/arch/arm64/mm/fault.c: die_kernel_fault()',
      'common/arch/arm64/kernel/traps.c: die()',
      'common/arch/arm64/include/asm/stacktrace.h',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },

  // ─────────────────────────────────────────────
  // Boot — deferred probe
  // ─────────────────────────────────────────────
  {
    _id: 'boot_deferred_probe',
    categoryId: 'boot',
    title: 'Deferred Probe：设备依赖探测机制',
    summary: 'driver probe 返回 -EPROBE_DEFER 时重新排队，待 supplier 就绪后再试',
    tags: ['boot', 'deferred_probe', 'fw_devlink', 'NVMe', 'X1P42100'],
    difficulty: 2,
    concept: `Deferred Probe 解决的问题：
设备 A 的 probe 依赖设备 B（clock/regulator/GPIO），
但 B 还没 probe 完成时，A 返回 -EPROBE_DEFER
→ kernel 将 A 放入 deferred 队列
→ 每次有新设备 probe 成功，重新尝试 deferred 队列

fw_devlink（5.11+）：
从 DT phandle 自动创建 device link，
强制 supplier 先于 consumer probe`,
    principle: `代码路径（drivers/base/dd.c）：
really_probe()
 → drv->probe(dev)
   → 返回 -EPROBE_DEFER
 → driver_deferred_probe_add(dev)
   → 加入 deferred_probe_pending_list

触发重试：
deferred_probe_work_func()
 → 每次新设备 probe 成功后调用
 → driver_deferred_probe_trigger()

fw_devlink.strict=1：
所有 DT phandle 引用都强制创建 device link，
consumer 必须等 supplier probe 完才能开始`,
    case: `X1P42100 NVMe 挂载间歇性超时（Hamoa.AL.2.0-00075）：
现象：开机 NVMe 分区挂载偶发超时，多次 reboot 复现

根因：
1. soc:nvme_vreg 依赖 f100000.pinctrl（supplier）
2. 并行 module load 时 pinctrl 模块还未就绪
3. nvme_vreg 返回 -EPROBE_DEFER
4. deferred 队列处理与 init.rc post-fs 时序冲突

Fix：
• 调整 modules.load 顺序，pinctrl 早于 nvme
• 或：fw_devlink 自动处理依赖顺序`,
    interviews: [
      {
        level: 'basic',
        question: '什么情况下驱动会返回 -EPROBE_DEFER？内核如何处理？',
        answer: `返回 -EPROBE_DEFER 的场景：
• 依赖的 clock 还没注册（clk_get 失败）
• 依赖的 regulator 还没注册（regulator_get 失败）
• 依赖的 GPIO 控制器还没 probe
• 依赖的 IRQ 域还没创建

内核处理：
1. 将设备加入 deferred_probe_pending_list
2. 每次有设备 probe 成功，调用 deferred_probe_work
3. 重新尝试 deferred 列表里的所有设备
4. 系统启动完成后（late_initcall）打印仍未 probe 的设备`,
      },
      {
        level: 'advanced',
        question: 'fw_devlink 是什么？strict 模式和非 strict 模式有什么区别？',
        answer: `fw_devlink 从 DT phandle 自动创建 device link（supplier → consumer）：

非 strict 模式（默认）：
• 只创建 link，不强制 probe 顺序
• consumer 可以在 supplier 未 probe 时也尝试 probe

strict 模式（fw_devlink.strict=1）：
• 强制 consumer 等 supplier probe 完成
• 更安全，但可能导致 probe 顺序死锁（circular dependency）
• 排查方法：cat /sys/kernel/debug/devices_deferred

适用场景：
strict=1 用于发布版本，确保依赖有序；
strict=0 用于调试，快速定位哪些依赖缺失`,
      },
    ],
    codeRefs: [
      'common/drivers/base/dd.c: really_probe()',
      'common/drivers/base/core.c: fw_devlink',
      'soc-repo/drivers/pinctrl/qcom/: pinctrl-msm.c',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },

  // ─────────────────────────────────────────────
  // IRQ — GICv3
  // ─────────────────────────────────────────────
  {
    _id: 'irq_gicv3',
    categoryId: 'irq',
    title: 'GICv3：ARM 通用中断控制器架构',
    summary: 'ARM64 平台标准中断控制器，支持 SPI/PPI/SGI/LPI，理解 GICD/GICR/ITS 分工',
    tags: ['GICv3', 'IRQ', 'SPI', 'MSI', 'ARM64'],
    difficulty: 2,
    concept: `GICv3 中断类型：
• SGI（0-15）:   软件生成，CPU间通信（IPI）
• PPI（16-31）:  私有外设，每个 CPU 独有（timer/WDT bark）
• SPI（32-1019）: 共享外设，路由到任意 CPU（UART/NVMe/WLAN）
• LPI（8192+）:  MSI 消息中断，PCIe 设备使用

组件分工：
GICD（Distributor）：全局管理，SPI 配置、路由
GICR（Redistributor）：每个 CPU 一个，PPI/SGI 管理
ITS（Interrupt Translation Service）：LPI/MSI 转换`,
    principle: `NVMe MSI 中断路径：
NVMe 设备写 MSI doorbell
 → ITS 接收消息
 → ITS 查 device table → event table
 → 转为 LPI INTID
 → GICR 分发给目标 CPU
 → CPU 进入 IRQ handler

Hamoa NVMe timeout 根因（内存中有记录）：
snps MSI controller 有 pending 但不 assert SPI 到 GICD
→ GICD 收不到中断 → NVMe timeout`,
    case: `WLAN CE 中断集中在 CPU0（Hamoa 案例）：
pci4_wlan_ce_2: CPU0=40171, CPU1=856，CPU2+=~0
affinity=0xf 但实际 97%+ 在 CPU0

根因：
1. 所有 CE IRQ 共用同一个 affinity hint（CPU0）
2. irqbalance 没有处理 WLAN 的 MSI 中断
3. CE（Copy Engine）RX 路径单线程处理

影响：CPU0 成为瓶颈，影响 WLAN 吞吐`,
    interviews: [
      {
        level: 'basic',
        question: 'SPI、PPI、SGI、LPI 分别是什么？各用于什么场景？',
        answer: `SGI（Software Generated Interrupt，0-15）：
  CPU 间通信，如 TLB shootdown、scheduler IPI

PPI（Private Peripheral Interrupt，16-31）：
  每个 CPU 独有的外设，如 ARM timer (PPI 30)、WDT bark

SPI（Shared Peripheral Interrupt，32+）：
  共享外设，可路由到任意 CPU：UART、NVMe、GPIO

LPI（Locality-specific Peripheral Interrupt，8192+）：
  PCIe MSI 消息中断，通过 ITS 动态分配，数量可扩展到数万`,
      },
      {
        level: 'advanced',
        question: 'IRQ affinity 的配置方式有哪些？如何查看某个 IRQ 当前在哪个 CPU 处理？',
        answer: `查看：
  cat /proc/interrupts          # 每个 CPU 的计数
  cat /proc/irq/<n>/affinity    # hex bitmask（如 0xf = CPU0-3）
  cat /proc/irq/<n>/effective_affinity_list

设置：
  echo <cpu_mask> > /proc/irq/<n>/smp_affinity
  irqbalance daemon（自动均衡）

内核启动参数：
  irqaffinity=0-3   # 所有硬件中断只走 CPU0-3（Hamoa 的配置）
  → CPU4-11 专门跑应用，减少中断打扰`,
      },
    ],
    codeRefs: [
      'common/drivers/irqchip/irq-gic-v3.c',
      'common/drivers/irqchip/irq-gic-v3-its.c',
      'soc-repo/drivers/irqchip/msm-gic-v3.c',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },

  // ─────────────────────────────────────────────
  // Build — Kleaf
  // ─────────────────────────────────────────────
  {
    _id: 'build_kleaf',
    categoryId: 'build',
    title: 'Kleaf：Bazel 内核构建系统',
    summary: 'AOSP 14+ 用 Bazel 替代传统 make 构建内核，理解三类配置机制避免踩坑',
    tags: ['Kleaf', 'Bazel', 'build', 'GKI', 'config', 'Hamoa'],
    difficulty: 2,
    concept: `Kleaf（Kernel Bazel）：
• Android 14+ 官方内核构建系统，替代 build.sh + make
• 增量构建快，支持远程缓存（RBE）
• 配置通过 .bzl 文件管理，而非直接修改 Kconfig

三类配置机制（Hamoa 平台）：
1. GKI config（不可改）：google_gki_defconfig，GKI ABI 保证
2. vendor config（.bzl 文件）：hamoa_la_perf.bzl，平台特定
3. fragment config（.config 片段）：覆盖特定选项`,
    principle: `构建命令：
./build_with_bazel.py -t hamoa_la perf
./build_with_bazel.py -t hamoa_la consolidate

配置层次（consolidate 编译）：
gki_defconfig（基础）
 + hamoa_consolidate.bzl（平台 config）
 + hamoa_la_consolidate.bzl（LA 特有 config）

踩坑案例：
在 hamoa_la_perf.bzl 加 CONFIG_MTD=y，
编译 hamoa_la consolidate 不生效！
原因：consolidate 读 hamoa_la_consolidate.bzl，不读 perf.bzl`,
    case: `CONFIG 不生效排查流程（Hamoa）：
问题：添加 CONFIG_MTD=y 后编译没有 MTD 驱动

排查：
1. out/hamoa_la_consolidate/dist/.config 确认 CONFIG_MTD 是否存在
2. 检查 hamoa_la_consolidate.bzl 是否有 CONFIG_MTD
3. 检查 GKI config 是否强制 CONFIG_MTD=n（不可覆盖）
4. 对比 perf 和 consolidate 的 .bzl 差异

结论：
• perf 和 consolidate 是独立 target，读不同 .bzl
• 修改需对应目标的 .bzl 文件`,
    interviews: [
      {
        level: 'basic',
        question: 'GKI（Generic Kernel Image）是什么？为什么需要它？',
        answer: `GKI 解决 Android 内核碎片化问题：
• 不同厂商（高通/MTK/三星）各自改内核 → 版本混乱
• GKI：Google 维护一个基础内核，厂商通过 DLKM（动态内核模块）添加扩展

三层结构：
GKI kernel（core） ← Google 维护，ABI 稳定
    ↓
vendor_dlkm        ← 厂商驱动模块（可单独 OTA）
    ↓
system_dlkm        ← 系统级模块

好处：厂商模块无需改 GKI core，ABI 兼容`,
      },
      {
        level: 'advanced',
        question: '如何在 Kleaf 构建系统中正确添加一个新的 kernel config？',
        answer: `步骤：
1. 确定目标是哪个 target：
   hamoa_la perf → 读 hamoa_la_perf.bzl
   hamoa_la consolidate → 读 hamoa_la_consolidate.bzl

2. 在对应 .bzl 文件的 kconfig_ext 里添加：
   "CONFIG_FOO": "y",

3. 验证是否生效：
   ./build_with_bazel.py -t hamoa_la perf
   grep CONFIG_FOO out/.../dist/.config

4. 注意 GKI ABI 限制：
   某些 config 被 GKI 锁定，不能覆盖
   用 scripts/abi/compare_gki_abi.sh 检查`,
      },
    ],
    codeRefs: [
      'kernel_platform/soc-repo/configs/hamoa_la_perf.bzl',
      'kernel_platform/soc-repo/configs/hamoa_la_consolidate.bzl',
      'kernel_platform/build_with_bazel.py',
    ],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04',
  },
]

module.exports = { categories, knowledge }

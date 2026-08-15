window.__ModuleLoader__.load({
	id: "@wsgsety/dsh-plugin-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var React = require("react");

		//#region styles
		var css = [
			".dpm-section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}",
			".dpm-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.5}",
			".dpm-status{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}",
			".dpm-error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;margin:0;font-size:13px;display:flex}",
			".dpm-error button{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}",
			".dpm-search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}",
			".dpm-search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 12px 0 34px;font-size:13px}",
			".dpm-search input::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".dpm-search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}",
			".dpm-searchIcon{pointer-events:none;position:absolute;left:12px}",
			".dpm-chips{align-items:center;gap:8px;display:flex}",
			".dpm-chip{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:3px 12px;font-size:12px;line-height:18px}",
			".dpm-chip:hover{color:var(--dsw-alias-label-primary)}",
			".dpm-chip[data-active=true]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary)}",
			".dpm-catalogHeading{align-items:baseline;gap:7px;padding:0 2px;display:flex}",
			".dpm-catalogHeading h3{margin:0;font-size:13px;font-weight:600;line-height:20px}",
			".dpm-catalogHeading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}",
			".dpm-cards{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}",
			".dpm-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;align-items:center;gap:12px;padding:10px 14px;display:flex}",
			".dpm-cardMain{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}",
			".dpm-cardName{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.4;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}",
			".dpm-cardSub{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}",
			".dpm-sourceLink{color:var(--dsw-alias-state-business-primary);text-decoration:none;font-size:11px;line-height:1.5;align-items:center;gap:2px;display:inline-flex;min-width:0}",
			".dpm-sourceLink:hover{text-decoration:underline}",
			".dpm-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
			".dpm-badgeOfficial{white-space:nowrap;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 15%,transparent);color:var(--dsw-alias-state-business-primary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
			".dpm-badgeProtected{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}",
			".dpm-statusDot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-label-dimmed)}",
			".dpm-statusDot[data-phase=active]{background:var(--dsw-alias-state-success-primary)}",
			".dpm-statusDot[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}",
			".dpm-statusDot[data-phase=loading],.dpm-statusDot[data-phase=unloading]{background:var(--dsw-alias-state-business-primary)}",
			".dpm-toggle{appearance:none;flex:none;width:36px;height:20px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);cursor:pointer;position:relative;transition:background .15s,border-color .15s;padding:0}",
			".dpm-toggle::after{content:\"\";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .15s,background .15s}",
			".dpm-toggle[aria-checked=true]{background:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}",
			".dpm-toggle[aria-checked=true]::after{transform:translateX(16px);background:var(--dsw-alias-bg-layer-1)}",
			".dpm-toggle:disabled{cursor:default;opacity:.55}",
			".dpm-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}",
			".dpm-row{align-items:center;gap:8px;display:flex}",
			".dpm-toast{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.5}",
			".dpm-toastError{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}",
			"@media (prefers-reduced-motion:reduce){.dpm-toggle{transition:none}}"
		].join("");
		var tagId = "dsh-plugin-manager/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			var tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-manager";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region host api
		function api(path, options) {
			return fetch(path, options).then(function (response) {
				return response.json().then(function (payload) {
					return { status: response.status, payload: payload };
				});
			});
		}
		/** Compact a module specifier for display. */
		function shortName(name) {
			if (name.startsWith("@")) {
				var slash = name.indexOf("/");
				if (slash !== -1) return name.slice(slash + 1);
			}
			// cordis: builtins (e.g. cordis:include) display as their bare id.
			if (name.startsWith("cordis:")) return name.slice("cordis:".length);
			return name;
		}
		//#endregion

		//#region plugin manage tab
		function ManageTab(props) {
			var t = props.t;
			var _React$useState = React.useState("loading"), state = _React$useState[0], setState = _React$useState[1];
			var _React$useState2 = React.useState(""), query = _React$useState2[0], setQuery = _React$useState2[1];
			var _React$useState3 = React.useState("all"), filter = _React$useState3[0], setFilter = _React$useState3[1];
			var _React$useState4 = React.useState(null), busyId = _React$useState4[0], setBusyId = _React$useState4[1];
			var _React$useState5 = React.useState(null), toast = _React$useState5[0], setToast = _React$useState5[1];
			var _React$useState6 = React.useState(0), reload = _React$useState6[0], setReload = _React$useState6[1];
			var _React$useState7 = React.useState(null), patchWarn = _React$useState7[0], setPatchWarn = _React$useState7[1];
			var mounted = React.useRef(true);

			React.useEffect(function () {
				mounted.current = true;
				var current = true;
				setState("loading");
				api("/dsh-plugin-manager/entries").then(function (result) {
					if (!current) return;
					if (result.status !== 200) {
						setState("error");
						return;
					}
					setState({ status: "ready", entries: result.payload.entries || [] });
					setPatchWarn(result.payload.patchError || null);
				}, function () {
					if (current) setState("error");
				});
				return function () { current = false; mounted.current = false; };
			}, [reload]);

			function toggle(entry) {
				setBusyId(entry.entryId);
				setToast(null);
				api("/dsh-plugin-manager/set-enabled", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ entryId: entry.entryId, enabled: !entry.enabled })
				}).then(function (result) {
					if (!mounted.current) return;
					setBusyId(null);
					if (result.status !== 200) {
						setToast({ error: true, text: (result.payload && result.payload.error) || t("toggleFailed") });
						return;
					}
					setState(function (previous) {
						if (previous.status !== "ready") return previous;
						var next = previous.entries.map(function (item) {
							return item.entryId === result.payload.entry.entryId ? result.payload.entry : item;
						});
						return { status: "ready", entries: next };
					});
					var payload = result.payload;
					var warnings = [];
					if (payload.settled === false) warnings.push(t("settling"));
					if (payload.patchError) warnings.push(t("patchWarn") + " " + payload.patchError);
					var base = payload.entry.enabled ? t("enabledOk") : t("disabledOk");
					setToast({ error: warnings.length > 0, text: warnings.length > 0 ? base + " " + warnings.join(" ") : base });
				}, function () {
					if (!mounted.current) return;
					setBusyId(null);
					setToast({ error: true, text: t("toggleFailed") });
				});
			}

			var normalized = query.trim().toLocaleLowerCase();
			var rows = [];
			if (state.status === "ready") {
				rows = state.entries.filter(function (entry) {
					if (filter === "official" && !entry.official) return false;
					if (filter === "third" && entry.official) return false;
					if (filter === "on" && !entry.enabled) return false;
					if (filter === "off" && entry.enabled) return false;
					if (normalized.length === 0) return true;
					return (entry.name + " " + entry.entryId).toLocaleLowerCase().includes(normalized);
				});
			}
			var statusText = function (entry) {
				if (!entry.enabled) return t("stopped");
				if (entry.fiberPhase === null) return t("unmounted");
				return t(entry.fiberPhase) || t("unmounted");
			};

			return React.createElement("div", { className: "dpm-section" },
				React.createElement("p", { className: "dpm-intro", children: t("manageIntro") }),
				state === "loading" ? React.createElement("p", { className: "dpm-status", children: t("loading") }) : null,
				state === "error" ? React.createElement("div", { className: "dpm-error" },
					React.createElement("p", { role: "alert", children: t("error") }),
					React.createElement("button", { type: "button", onClick: function () { setReload(function (v) { return v + 1; }); }, children: t("retry") })
				) : null,
				patchWarn ? React.createElement("div", { className: "dpm-toast dpm-toastError", role: "alert", children: t("patchBanner") + " " + patchWarn }) : null,
				state.status === "ready" ? React.createElement(React.Fragment, null,
					React.createElement("label", { className: "dpm-search" },
						React.createElement("span", { className: "dpm-searchIcon", "aria-hidden": "true", children: "\u2315" }),
						React.createElement("input", { type: "search", value: query, placeholder: t("search"), "aria-label": t("search"), onChange: function (event) { setQuery(event.currentTarget.value); } })
					),
					React.createElement("div", { className: "dpm-chips" },
						[["all", t("all")], ["official", t("official")], ["third", t("third")], ["on", t("filterOn")], ["off", t("filterOff")]].map(function (chip) {
							return React.createElement("button", {
								key: chip[0], type: "button", className: "dpm-chip", "data-active": filter === chip[0] ? "true" : undefined,
								onClick: function () { setFilter(chip[0]); }, children: chip[1]
							});
						})
					),
					React.createElement("div", { className: "dpm-catalogHeading" },
						React.createElement("h3", { children: t("catalog") }),
						React.createElement("span", { "data-plugin-count": rows.length, children: rows.length })
					),
					rows.length === 0 ? React.createElement("p", { className: "dpm-status", children: normalized.length > 0 ? t("emptySearch") : t("empty") }) : null,
					rows.length > 0 ? React.createElement("ul", { className: "dpm-cards" }, rows.map(function (entry) {
						return React.createElement("li", { key: entry.entryId, className: "dpm-card", "data-plugin-entry": entry.entryId },
							React.createElement("div", { className: "dpm-cardMain" },
								React.createElement("div", { className: "dpm-row" },
									React.createElement("span", { className: "dpm-cardName", title: entry.name, children: shortName(entry.name) }),
									entry.official ? React.createElement("span", { className: "dpm-badgeOfficial", children: t("officialBadge") }) : null,
									entry.protected ? React.createElement("span", { className: "dpm-badgeProtected", children: "\u{1F512} " + t("protected") }) : null
								),
								React.createElement("span", { className: "dpm-cardSub", title: entry.entryId, children: entry.entryId }),
								entry.source && !entry.official ? React.createElement("a", {
									className: "dpm-sourceLink", href: entry.source.url, target: "_blank", rel: "noreferrer noopener",
									"aria-label": t("source") + ": " + entry.source.url, title: entry.source.url,
									children: entry.source.url.replace(/^https?:\/\//, "") + " \u2197"
								}) : null
							),
							React.createElement("div", { className: "dpm-row" },
								entry.enabled ? React.createElement("span", { className: "dpm-statusDot", "data-phase": entry.fiberPhase ?? "unobserved", role: "img", "aria-label": statusText(entry), title: statusText(entry) }) : null,
								React.createElement("span", { className: "dpm-badge", children: statusText(entry) }),
								entry.protected ? null : React.createElement("button", {
									type: "button", className: "dpm-toggle", role: "switch", "aria-checked": entry.enabled ? "true" : "false",
									"aria-label": t(entry.enabled ? "disable" : "enable") + ": " + shortName(entry.name),
									disabled: busyId === entry.entryId,
									onClick: function () { toggle(entry); }
								})
							)
						);
					})) : null,
					toast ? React.createElement("div", { className: toast.error ? "dpm-toast dpm-toastError" : "dpm-toast", role: toast.error ? "alert" : "status", children: toast.text }) : null
				) : null
			);
		}
		//#endregion


		//#region locales
		var zh = {
			tab: "插件管理",
			manageIntro: "在此启用或停用已安装的插件。切换立即生效，并写入 cordis.patch.yml，重启后保持。",
			loading: "正在读取…",
			error: "暂时无法读取插件数据。",
			retry: "重试",
			search: "搜索插件",
			catalog: "插件列表",
			all: "全部",
			official: "官方",
			third: "第三方",
			filterOn: "已启用",
			filterOff: "已停用",
			source: "源码",
			officialBadge: "官方",
			protected: "受保护",
			empty: "暂无插件。",
			emptySearch: "没有匹配的插件。",
			enable: "启用",
			disable: "停用",
			toggleFailed: "切换失败，请稍后重试。",
			enabledOk: "已启用（立即生效，重启后保持）。",
			disabledOk: "已停用（立即生效，重启后保持）。",
			settling: "切换仍在进行，请稍后刷新确认。",
			patchWarn: "已实时切换，但写入 cordis.patch.yml 失败，重启后不会保持：",
			patchBanner: "警告：cordis.patch.yml 无法解析，启停将无法持久化（重启后不保持）。",
			running: "已启用",
			stopped: "已停用",
			unmounted: "未挂载",
			pending: "等待依赖",
			loadingPhase: "加载中",
			active: "运行中",
			failed: "挂载失败",
			unloading: "卸载中",
		};
		var en = {
			tab: "Plugin manager",
			manageIntro: "Enable or disable installed plugins. Changes take effect immediately and are written to cordis.patch.yml so they survive restarts.",
			loading: "Loading…",
			error: "Plugin data is temporarily unavailable.",
			retry: "Retry",
			search: "Search plugins",
			catalog: "Plugin list",
			all: "All",
			official: "Official",
			third: "Third-party",
			filterOn: "Enabled",
			filterOff: "Disabled",
			source: "Source",
			officialBadge: "Official",
			protected: "Protected",
			empty: "No plugins are available.",
			emptySearch: "No matching plugins.",
			enable: "Enable",
			disable: "Disable",
			toggleFailed: "The switch failed; try again later.",
			enabledOk: "Enabled (live now, persists across restarts).",
			disabledOk: "Disabled (live now, persists across restarts).",
			settling: "Still switching; re-check shortly.",
			patchWarn: "Switched live, but writing cordis.patch.yml failed — this will not survive a restart:",
			patchBanner: "Warning: cordis.patch.yml cannot be parsed, so enable/disable cannot persist across restarts.",
			running: "Enabled",
			stopped: "Disabled",
			unmounted: "Not mounted",
			pending: "Waiting for dependencies",
			loadingPhase: "Loading",
			active: "Active",
			failed: "Mount failed",
			unloading: "Unloading",
		};
		//#endregion

		//#region index
		var NS = "pluginManager";
		var inject = ["slots", "locale"];

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.locale.register(NS, { zh: zh, en: en });
			}, "dsh-plugin-manager: dictionaries");
			var t = ctx.locale.bind(NS);

			// 设置 → 插件 → 「插件管理」tab（放在官方只读「插件列表」之前）
			ctx.slots.inject("settings.plugins.tab", function () {
				return ctx.slots.register({
					name: "settings.plugins.tab",
					id: "pm-manage",
					order: 9,
					label: function () { return t("tab"); },
					locale: NS,
					inject: function () { return { t: t }; }
				}, ManageTab);
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

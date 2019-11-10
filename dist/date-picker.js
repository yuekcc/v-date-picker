(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.SSS = factory());
}(this, (function () { 'use strict';

    function noop() { }
    const identity = x => x;
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
        }
        return {
            promise: new Promise(fulfil => {
                tasks.add(task = [fn, fulfil]);
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function fade(node, { delay = 0, duration = 400 }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            css: t => `opacity: ${t * o}`
        };
    }

    /* src\DatePanel.svelte generated by Svelte v3.12.1 */

    function add_css() {
    	var style = element("style");
    	style.id = 'svelte-10i830h-style';
    	style.textContent = ".panel.svelte-10i830h{position:absolute;left:0;box-shadow:0 5px 10px rgba(0, 0, 0, 0.1)}.row.svelte-10i830h{display:flex}.row-between.svelte-10i830h{justify-content:space-between}.cell.svelte-10i830h{flex:1}.cell-initial.svelte-10i830h{flex:initial}.label.svelte-10i830h{line-height:2;text-align:center}";
    	append(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.date = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.row = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.item = list[i];
    	return child_ctx;
    }

    // (124:4) {#each WEEKDAYS as item}
    function create_each_block_2(ctx) {
    	var div, t_value = ctx.item + "", t;

    	return {
    		c() {
    			div = element("div");
    			t = text(t_value);
    			attr(div, "class", "cell label svelte-10i830h");
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t);
    		},

    		p: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    // (130:6) {#each row as date}
    function create_each_block_1(ctx) {
    	var div, a, t_value = ctx.date.getDate() + "", t, dispose;

    	function click_handler_4() {
    		return ctx.click_handler_4(ctx);
    	}

    	return {
    		c() {
    			div = element("div");
    			a = element("a");
    			t = text(t_value);
    			attr(a, "href", "javascript:");
    			attr(div, "class", "cell label svelte-10i830h");
    			dispose = listen(a, "click", prevent_default(click_handler_4));
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, a);
    			append(a, t);
    		},

    		p(changed, new_ctx) {
    			ctx = new_ctx;
    			if ((changed.datesTable) && t_value !== (t_value = ctx.date.getDate() + "")) {
    				set_data(t, t_value);
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			dispose();
    		}
    	};
    }

    // (128:2) {#each datesTable as row}
    function create_each_block(ctx) {
    	var div, t;

    	let each_value_1 = ctx.row;

    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr(div, "class", "row svelte-10i830h");
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t);
    		},

    		p(changed, ctx) {
    			if (changed.datesTable) {
    				each_value_1 = ctx.row;

    				let i;
    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value_1.length;
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	var div8, div6, div0, a0, t1, div1, a1, t3, div2, t4_value = ctx.value.getFullYear() + "", t4, t5, t6, div3, t7_value = ctx.value.getMonth() + 1 + "", t7, t8, t9, div4, a2, t11, div5, a3, t13, div7, t14, dispose;

    	let each_value_2 = ctx.WEEKDAYS;

    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = ctx.datesTable;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div8 = element("div");
    			div6 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			a0.textContent = "⇤";
    			t1 = space();
    			div1 = element("div");
    			a1 = element("a");
    			a1.textContent = "←";
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = text(" 年");
    			t6 = space();
    			div3 = element("div");
    			t7 = text(t7_value);
    			t8 = text(" 月");
    			t9 = space();
    			div4 = element("div");
    			a2 = element("a");
    			a2.textContent = "→";
    			t11 = space();
    			div5 = element("div");
    			a3 = element("a");
    			a3.textContent = "⇥";
    			t13 = space();
    			div7 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t14 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    			attr(a0, "href", "javascript:");
    			attr(div0, "class", "cell label svelte-10i830h");
    			attr(a1, "href", "javascript:");
    			attr(div1, "class", "cell label svelte-10i830h");
    			attr(div2, "class", "cell-initial label svelte-10i830h");
    			attr(div3, "class", "cell-initial label svelte-10i830h");
    			attr(a2, "href", "javascript:");
    			attr(div4, "class", "cell label svelte-10i830h");
    			attr(a3, "href", "javascript:");
    			attr(div5, "class", "cell label svelte-10i830h");
    			attr(div6, "class", "row row-between svelte-10i830h");
    			attr(div7, "class", "row svelte-10i830h");
    			set_style(div8, "width", ctx.width);
    			set_style(div8, "z-index", ctx.zindex);
    			attr(div8, "class", "panel svelte-10i830h");

    			dispose = [
    				listen(a0, "click", prevent_default(ctx.click_handler)),
    				listen(a1, "click", prevent_default(ctx.click_handler_1)),
    				listen(a2, "click", prevent_default(ctx.click_handler_2)),
    				listen(a3, "click", prevent_default(ctx.click_handler_3))
    			];
    		},

    		m(target, anchor) {
    			insert(target, div8, anchor);
    			append(div8, div6);
    			append(div6, div0);
    			append(div0, a0);
    			append(div6, t1);
    			append(div6, div1);
    			append(div1, a1);
    			append(div6, t3);
    			append(div6, div2);
    			append(div2, t4);
    			append(div2, t5);
    			append(div6, t6);
    			append(div6, div3);
    			append(div3, t7);
    			append(div3, t8);
    			append(div6, t9);
    			append(div6, div4);
    			append(div4, a2);
    			append(div6, t11);
    			append(div6, div5);
    			append(div5, a3);
    			append(div8, t13);
    			append(div8, div7);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div7, null);
    			}

    			append(div8, t14);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div8, null);
    			}
    		},

    		p(changed, ctx) {
    			if ((changed.value) && t4_value !== (t4_value = ctx.value.getFullYear() + "")) {
    				set_data(t4, t4_value);
    			}

    			if ((changed.value) && t7_value !== (t7_value = ctx.value.getMonth() + 1 + "")) {
    				set_data(t7, t7_value);
    			}

    			if (changed.WEEKDAYS) {
    				each_value_2 = ctx.WEEKDAYS;

    				let i;
    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(changed, child_ctx);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div7, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}
    				each_blocks_1.length = each_value_2.length;
    			}

    			if (changed.datesTable) {
    				each_value = ctx.datesTable;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div8, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (changed.width) {
    				set_style(div8, "width", ctx.width);
    			}

    			if (changed.zindex) {
    				set_style(div8, "z-index", ctx.zindex);
    			}
    		},

    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div8);
    			}

    			destroy_each(each_blocks_1, detaching);

    			destroy_each(each_blocks, detaching);

    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

      const addDate = (d, factor) => {
        return new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate() + factor,
          d.getHours(),
          d.getMinutes(),
          d.getSeconds()
        );
      };

      const addMonth = (d, factor) => {
        return new Date(
          d.getFullYear(),
          d.getMonth() + factor,
          d.getDate(),
          d.getHours(),
          d.getMinutes(),
          d.getSeconds()
        );
      };

      const getFirstDateOfMonth = d => {
        return new Date(
          d.getFullYear(),
          d.getMonth(),
          1,
          d.getHours(),
          d.getMinutes(),
          d.getSeconds()
        );
      };

      const createDatesTable = firstDateOfMonth => {
        let weekdayIndex =
          firstDateOfMonth.getDay() === 0 ? 6 : firstDateOfMonth.getDay() - 1;
        let factorBase = weekdayIndex === 0 ? 0 : 0 - weekdayIndex;

        let dates = [];
        for (let i = 0; i < 42; i++) {
          dates[i] = addDate(firstDateOfMonth, factorBase + i);
        }

        let table = [];
        for (let i = 0; i < 6; i++) {
          table.push(dates.slice(i * 7, i * 7 + 7));
        }

        return table;
      };

      let { initialValue = new Date(), width = "300px", zindex = "1200" } = $$props;

      let value = initialValue;
      let dispatch = createEventDispatcher();

    	const click_handler = () => nextMonth(-12);

    	const click_handler_1 = () => nextMonth(-1);

    	const click_handler_2 = () => nextMonth(1);

    	const click_handler_3 = () => nextMonth(12);

    	const click_handler_4 = ({ date }) => selectDate(date);

    	$$self.$set = $$props => {
    		if ('initialValue' in $$props) $$invalidate('initialValue', initialValue = $$props.initialValue);
    		if ('width' in $$props) $$invalidate('width', width = $$props.width);
    		if ('zindex' in $$props) $$invalidate('zindex', zindex = $$props.zindex);
    	};

    	let firstDate, datesTable, selectDate, nextMonth;

    	$$self.$$.update = ($$dirty = { dispatch: 1, value: 1, firstDate: 1 }) => {
    		if ($$dirty.dispatch) { $$invalidate('selectDate', selectDate = d => {
            $$invalidate('value', value = d);
            dispatch("change", d);
          }); }
    		if ($$dirty.value) { $$invalidate('nextMonth', nextMonth = factor => {
            $$invalidate('value', value = addMonth(value, factor));
          }); }
    		if ($$dirty.value) { $$invalidate('firstDate', firstDate = getFirstDateOfMonth(value)); }
    		if ($$dirty.firstDate) { $$invalidate('datesTable', datesTable = createDatesTable(firstDate)); }
    	};

    	return {
    		WEEKDAYS,
    		initialValue,
    		width,
    		zindex,
    		value,
    		datesTable,
    		selectDate,
    		nextMonth,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4
    	};
    }

    class DatePanel extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-10i830h-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, ["initialValue", "width", "zindex"]);
    	}
    }

    /* src\DatePicker.svelte generated by Svelte v3.12.1 */

    // (54:2) {#if canShowPanel}
    function create_if_block(ctx) {
    	var div, div_transition, current;

    	var datepanel = new DatePanel({
    		props: {
    		width: width,
    		zindex: zindex,
    		initialValue: ctx.selectedDate
    	}
    	});
    	datepanel.$on("change", ctx.selectDate);

    	return {
    		c() {
    			div = element("div");
    			datepanel.$$.fragment.c();
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(datepanel, div, null);
    			current = true;
    		},

    		p(changed, ctx) {
    			var datepanel_changes = {};
    			if (changed.selectedDate) datepanel_changes.initialValue = ctx.selectedDate;
    			datepanel.$set(datepanel_changes);
    		},

    		i(local) {
    			if (current) return;
    			transition_in(datepanel.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { delay: 0, duration: 200 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},

    		o(local) {
    			transition_out(datepanel.$$.fragment, local);

    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { delay: 0, duration: 200 }, false);
    			div_transition.run(0);

    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			destroy_component(datepanel);

    			if (detaching) {
    				if (div_transition) div_transition.end();
    			}
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var div, input, input_value_value, t, current, dispose;

    	var if_block = (ctx.canShowPanel) && create_if_block(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			if (if_block) if_block.c();
    			input.readOnly = true;
    			input.value = input_value_value = ctx.display(ctx.selectedDate);
    			set_style(div, "width", "auto");
    			set_style(div, "position", "relative");
    			dispose = listen(input, "focus", ctx.startShowPanel);
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			append(div, t);
    			if (if_block) if_block.m(div, null);
    			ctx.div_binding(div);
    			current = true;
    		},

    		p(changed, ctx) {
    			if ((!current || changed.selectedDate) && input_value_value !== (input_value_value = ctx.display(ctx.selectedDate))) {
    				input.value = input_value_value;
    			}

    			if (ctx.canShowPanel) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();
    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});
    				check_outros();
    			}
    		},

    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},

    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			if (if_block) if_block.d();
    			ctx.div_binding(null);
    			dispose();
    		}
    	};
    }

    let width = "300px";

    let zindex = "1200";

    function instance$1($$self, $$props, $$invalidate) {
    	

      const dispatch = createEventDispatcher();

      const display = d => {
        let year = `${d.getFullYear()}`;
        let month = `${d.getMonth() + 1}`.padStart(2, "0");
        let date = `${d.getDate()}`.padStart(2, "0");

        return `${year}-${month}-${date}`;
      };
      let canShowPanel = false;
      let selectedDate = new Date();

      const startShowPanel = e => {
        $$invalidate('canShowPanel', canShowPanel = true);
      };

      const closePanel = () => ($$invalidate('canShowPanel', canShowPanel = false));

      const selectDate = e => {
        $$invalidate('selectedDate', selectedDate = e.detail);

        dispatch("change", selectedDate);
        closePanel();
      };

      // 处理 click outside
      let container;
      const clickOutsideHandler = e => {
        if (!container.contains(e.target)) {
          closePanel();
        }
      };

      onMount(() => {
        document.addEventListener("click", clickOutsideHandler);
      });

      onDestroy(() => {
        document.removeEventListener("click", clickOutsideHandler);
      });

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('container', container = $$value);
    		});
    	}

    	return {
    		display,
    		canShowPanel,
    		selectedDate,
    		startShowPanel,
    		selectDate,
    		container,
    		div_binding
    	};
    }

    class DatePicker extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    	}
    }

    var index = { DatePicker };

    return index;

})));

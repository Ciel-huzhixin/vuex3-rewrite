

let Vue; 
function forEach(obj, callback) {
  Object.keys(obj).forEach(item => callback(item, obj[item]));
} 
class ModuleCollection {
  constructor(options) {
    // []是路径列表，用来实现递归嵌套取值
    this.register([], options);
  }
  register(path, rawModule) {
    let newModule = {
      _raw: rawModule,
      _children: {},
      state: rawModule.state
    }
    if (path.length == 0) {
      this.root = newModule;
    } else {
      let parent = path.slice(0, -1).reduce((root, current) => {
        return root._children[current];
      }, this.root);
      parent._children[path[path.length - 1]] = newModule;
    }
    if (rawModule.modules) {
      forEach(rawModule.modules, (childName, module) => {
        this.register(path.concat(childName), module);
      })
    }
  }
}
function installModule(store, rootState, path, rootModule) {
  // 处理module中的state
  if (path.length > 0) {
    let parent = path.slice(0, -1).reduce((root, current) => {
      console.log(current)
      return root[current];
    }, rootState);
    // console.log(path[path.length - 1]);
    // console.log(rootModule.state);
    if (parent != undefined) {
      Vue.set(parent, path[path.length - 1], rootModule.state);
    }
  }
  // 处理module中的getters
  if (rootModule._raw.getters) {
    forEach(rootModule._raw.getters, (getterName, getterFn) => {
      Object.defineProperty(store.getters, getterName, {
        get: () => {
          return getterFn(rootModule.state);
        }
      })
    })
  }
  // 处理module中的actions
  if (rootModule._raw.actions) {
    forEach(rootModule._raw.actions, (actionName, actionFn) => {
      let entry = store.actions[actionName] || (store.actions[actionName] = []);
      entry.push(() => {
        actionFn.call(this, store);
      })
    })
  }
  // 处理module中的mutations
  if (rootModule._raw.mutations) {
    forEach(rootModule._raw.mutations, (mutationName, mutationFn) => {
      let entry = store.mutations[mutationName] || (store.mutations[mutationName] = []);
      entry.push(() => {
        mutationFn.call(this, rootModule.state);
      })
    })
  }
  // 递归挂载module
  forEach(rootModule._children, (childName, module) => {
    installModule(store, rootState, path.concat(childName), module);
  })
}
class Store {
  constructor(options) {
    let state = options.state;
    this.getters = {};
    this.mutations = {};
    this.actions = {};
    // 借助Vue实例实现state数据的响应式
    this._vm = new Vue({
      data: state
    });

    // 整理modules模块关系，递归生成
    this.modules = new ModuleCollection(options);
    // 安装子模块实例方法
    installModule(this, state, [], this.modules.root);
    // console.log(this.modules);
    // if (options.getters) {
    //   let getters = options.getters;
    //   forEach(getters, (getterName, getterFn) => {
    //     Object.defineProperty(this.getters, getterName, {
    //       get: () => {
    //         return getterFn(state);
    //       }
    //     })
    //   })
    // }
    // let mutations = options.mutations;
    // forEach(mutations, (mutationName, mutationFn) => {
    //   this.mutations[mutationName] = () => {
    //     mutationFn.call(this, state);
    //   }
    // })
    // let actions = options.actions;
    // forEach(actions, (actionName, actionFn) => {
    //   this.actions[actionName] = () => {
    //     actionFn.call(this, this);
    //   }
    // })
    let { commit, dispatch } = this;
    this.commit = type => {
      commit.call(this, type);
    }
    this.dispatch = type => {
      dispatch.call(this, type);
    }
  }
  commit(type) {
    // 将所有模块中的mutations 一并执行
    this.mutations[type].forEach(mutationFn => mutationFn());
  }
  dispatch(type) {
    // 将所有模块中的actions 一并执行
    this.actions[type].forEach(actionFn => actionFn());
  }
  get state() {
    // 返回通过Vue包装后的state实例
    return this._vm;
  }
}
let install = (_Vue) => {
  Vue = _Vue;
  Vue.mixin({
    beforeCreate() {
      if (this.$options && this.$options.store) {
        this.$store = this.$options.store;
      } else {
        this.$store = this.$parent && this.$parent.$store;
      }
    },
  })
}

export default {
  Store,
  install
}